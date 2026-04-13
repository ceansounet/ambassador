import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

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
  const rawState = formData.get("state");
  const trimmedState = typeof rawState === "string" ? rawState.trim() : "";
  const nextState = trimmedState.length === 0 ? null : trimmedState;

  if (nextState && !isUserManualDashboardState(nextState)) {
    return Response.json({ error: "invalid_state" }, { status: 400 });
  }

  const [currentUser] = await sql<{ id: string; manual_dashboard_state: string | null }[]>`
    SELECT id, manual_dashboard_state
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!currentUser) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await sql`
    UPDATE users
    SET manual_dashboard_state = ${nextState},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  if ((currentUser.manual_dashboard_state ?? null) !== nextState) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "user_manual_dashboard_state_updated",
      metadata: {
        previousState: currentUser.manual_dashboard_state ?? null,
        nextState,
      },
    });
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/dashboard");

  return Response.redirect(getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}`));
}
