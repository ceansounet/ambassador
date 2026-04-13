import { logAdminActionEvent } from "@/lib/admin-action-events";
import { clearImpersonationSession } from "@/lib/session";
import { getSession } from "@/lib/session";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const session = await getSession();

  if (session?.impersonator) {
    await logAdminActionEvent({
      actorUserId: session.impersonator.sub,
      targetUserId: session.sub,
      action: "user_impersonation_stopped",
      metadata: {
        impersonationStartedAt: session.impersonationStartedAt ?? null,
      },
    });
  }

  await clearImpersonationSession();

  return Response.redirect(getSafeRedirectUrl(request, formData.get("redirectTo"), "/dashboard"));
}
