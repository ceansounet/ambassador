import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import { revalidatePath } from "next/cache";
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
  const postersEnabled = formData.has("postersEnabled");
  const [currentUser] = await sql<{ id: string; posters_enabled: boolean | null }[]>`
    SELECT id, posters_enabled
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!currentUser) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await sql`
    UPDATE users
    SET posters_enabled = ${postersEnabled},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  if (Boolean(currentUser.posters_enabled) !== postersEnabled) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "user_posters_enabled_updated",
      metadata: {
        previousPostersEnabled: Boolean(currentUser.posters_enabled),
        nextPostersEnabled: postersEnabled,
      },
    });
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/posters");
  revalidatePath("/dashboard");

  return Response.redirect(getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}`));
}
