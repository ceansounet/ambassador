import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import {
  isSafeguardKey,
  listSafeguardStates,
  SAFEGUARD_KEYS,
  setSafeguard,
} from "@/lib/safeguards";
import { getActorSession } from "@/lib/session";

export async function PATCH(request: Request) {
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

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const payload = Object.fromEntries(Object.entries(body));
  if (!isSafeguardKey(payload.key) || typeof payload.enabled !== "boolean") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const currentState = (await listSafeguardStates())
    .find((state) => state.key === payload.key);
  const previousEnabled = currentState?.enabled ?? true;
  const updatedState = await setSafeguard({
    key: payload.key,
    enabled: payload.enabled,
    updatedByUserId: session.sub,
  });

  if (previousEnabled !== payload.enabled) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      action: "global_safeguard_updated",
      metadata: {
        safeguard: getSafeguardAuditName(payload.key),
        previousEnabled,
        nextEnabled: payload.enabled,
      },
    });
  }

  revalidatePath("/admin/safeguards");
  revalidatePath("/admin/audit-log");
  revalidatePath("/dashboard");

  return Response.json({ safeguard: updatedState });
}

function getSafeguardAuditName(key: string) {
  if (key === SAFEGUARD_KEYS.onboardingEnabled) {
    return "onboarding";
  }

  if (key === SAFEGUARD_KEYS.shirtOrderingEnabled) {
    return "shirt ordering";
  }

  if (key === SAFEGUARD_KEYS.postersEnabled) {
    return "posters";
  }

  if (key === SAFEGUARD_KEYS.payoutsEnabled) {
    return "payouts";
  }

  return "referrals";
}
