import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";

type ExistingApplicationRow = {
  id: string;
  user_id: string | null;
  review_on_hold: boolean | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;
  const formData = await request.formData();
  const nextOnHold = formData.get("onHold") === "true";
  const existingApplication = (await sql<ExistingApplicationRow[]>`
    SELECT id, user_id, review_on_hold
    FROM applications
    WHERE id = ${id}
    LIMIT 1
  `).at(0) ?? null;

  if (existingApplication === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await sql`
    UPDATE applications
    SET review_on_hold = ${nextOnHold},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  if (Boolean(existingApplication.review_on_hold) !== nextOnHold) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: existingApplication.user_id ?? null,
      action: "application_review_hold_updated",
      metadata: {
        applicationId: id,
        previousOnHold: Boolean(existingApplication.review_on_hold),
        nextOnHold,
      },
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);

  return Response.redirect(
    getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/applications/${id}`),
  );
}
