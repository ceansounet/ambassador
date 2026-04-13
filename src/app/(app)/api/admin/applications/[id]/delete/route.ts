import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getActorSession } from "@/lib/session";
import sql from "@/lib/database/client";

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

  const [deleted] = await sql`
    DELETE FROM applications
    WHERE id = ${id}
    RETURNING id, user_id, status
  `;

  if (!deleted) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await logAdminActionEvent({
    actorUserId: session.sub,
    targetUserId: deleted.user_id ?? null,
    action: "application_deleted",
    metadata: {
      applicationId: deleted.id,
      status: deleted.status ?? null,
    },
  });

  return Response.redirect(
    getSafeRedirectUrl(request, formData.get("redirectTo"), "/admin/applications"),
  );
}
