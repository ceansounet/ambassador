import { revalidatePath } from "next/cache";

import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectPath, isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
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

  const [updatedUser] = await sql<{ id: string }[]>`
    UPDATE users
    SET manual_dashboard_state = ${nextState},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;

  if (!updatedUser) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/dashboard");

  return Response.redirect(
    new URL(
      getSafeRedirectPath(formData.get("redirectTo"), `/admin/users/${id}`),
      request.url,
    ),
  );
}
