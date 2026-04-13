import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin, setApplicationTshirtShipped } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";

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
  const value = formData.get("shipped");
  const shipped = value === "true";
  const [existingApplication] = await sql<{
    id: string;
    user_id: string | null;
    tshirt_shipped: boolean | null;
  }[]>`
    SELECT id, user_id, tshirt_shipped
    FROM applications
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!existingApplication) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const updatedApplication = await setApplicationTshirtShipped(id, shipped);

  if (!updatedApplication) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (Boolean(existingApplication.tshirt_shipped) !== shipped) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: existingApplication.user_id ?? null,
      action: "application_tshirt_shipped_updated",
      metadata: {
        applicationId: id,
        previousShipped: Boolean(existingApplication.tshirt_shipped),
        nextShipped: shipped,
      },
    });
  }

  return Response.redirect(
    getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/applications/${id}`),
  );
}
