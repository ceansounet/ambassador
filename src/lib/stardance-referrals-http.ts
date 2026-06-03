import "server-only";

import { ensureSchema } from "@/lib/database/ensure-schema";
import { getPosterAccessState } from "@/lib/posters/access";
import { getEffectiveSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

class StardanceReferralRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StardanceReferralRequestError";
  }
}

export async function requireStardanceReferralSession() {
  const session = await getSession();

  if (!session) {
    throw new StardanceReferralRequestError("Unauthorized", 401);
  }

  await ensureSchema();
  const [user, safeguards] = await Promise.all([
    getPosterAccessState(session.sub),
    getEffectiveSafeguards(session.sub),
  ]);

  if (
    user === null ||
    !canAccessStardanceReferrals({
      latestApplicationStatus: user.latest_application_status ?? null,
      manualDashboardState: user.manual_dashboard_state ?? null,
      isOnboardingComplete: user.is_onboarding_complete,
      isAdmin: Boolean(session.impersonator) || Boolean(user.is_admin ?? session.isAdmin),
    })
  ) {
    throw new StardanceReferralRequestError("Forbidden", 403);
  }

  if (!safeguards.referralsEnabled) {
    throw new StardanceReferralRequestError("Coming soon!", 403);
  }

  return session;
}

export function stardanceReferralErrorResponse(error: unknown, fallback: string) {
  if (error instanceof StardanceReferralRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    console.error(error);
  }

  return Response.json({ error: fallback }, { status: 400 });
}
