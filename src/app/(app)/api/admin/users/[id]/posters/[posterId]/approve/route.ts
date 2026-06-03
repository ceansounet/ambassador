import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import {
  assertPosterUnlockedForReview,
  PayoutRequestError,
} from "@/lib/payouts/service";
import type { PosterRow } from "@/lib/posters/types";
import { getActorSession } from "@/lib/session";

export const runtime = "nodejs";

// Approve a poster's proof (-> success, credits the ledger $1) or undo an
// accidental approval (-> pending, claws the $1 back). Used by the payout
// review screen; rejection lives in the sibling reject route.
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
  const rawStatus = formData.get("status");
  const status = rawStatus === "pending" ? "pending" : "success";

  // Posters locked in a payout are only reviewable from that payout's screen
  // (which sends its payoutId along), never from the user page.
  const viaPayoutId = formData.get("payoutId");
  try {
    await assertPosterUnlockedForReview(
      posterId,
      typeof viaPayoutId === "string" && viaPayoutId !== "" ? viaPayoutId : null,
    );
  } catch (error) {
    if (error instanceof PayoutRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const [poster] = await sql<PosterRow[]>`
    UPDATE posters
    SET verification_status = ${status},
        verified_at = CASE WHEN ${status} = 'success' THEN NOW() ELSE verified_at END,
        rejection_reason = NULL,
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
    action: "poster_approved_by_admin",
    metadata: {
      posterId: poster.id,
      referralCode: poster.referral_code,
      status,
    },
  });

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/audit-log");

  return Response.redirect(
    getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}#posters`),
  );
}
