import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import type { PosterRow } from "@/lib/posters/types";
import { getActorSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; posterId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id, posterId } = await params;
  const formData = await request.formData();
  const rawReason = formData.get("reason");
  const reason =
    typeof rawReason === "string" && rawReason.trim().length > 0
      ? rawReason.trim()
      : null;

  const [poster] = await sql<PosterRow[]>`
    UPDATE posters
    SET verification_status = 'rejected',
        rejection_reason = ${reason},
        updated_at = NOW()
    WHERE id = ${posterId} AND user_id = ${id}
    RETURNING *
  `;

  if (!poster) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await logAdminActionEvent({
    actorUserId: session.sub,
    targetUserId: poster.user_id,
    action: "poster_rejected_by_admin",
    metadata: {
      posterId: poster.id,
      referralCode: poster.referral_code,
      reason,
    },
  });

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/audit-log");

  return Response.redirect(
    getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}#posters`),
  );
}
