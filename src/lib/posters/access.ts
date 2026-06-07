import { cache } from "react";

import sql from "@/lib/database/client";
import { getAmbassadorOnboardingStatus } from "@/lib/ambassadors/airtable";
import { isAcceptedApplicationStatus } from "@/lib/applications/status";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

export type PosterAccessState = {
  balance_cents?: number | null;
  is_admin?: boolean | null;
  manual_dashboard_state?: string | null;
  latest_application_status?: string | null;
  country_code?: string | null;
  ambassador_region?: string | null;
  slack_id?: string | null;
  display_name?: string | null;
  is_onboarding_complete: boolean;
};

type AccessStateRow = Omit<PosterAccessState, "is_onboarding_complete"> & {
  latest_application_id: string | null;
};

// cache() so the (nav) layout and the page it wraps share one lookup per request.
export const getPosterAccessState = cache(async (userId: string): Promise<PosterAccessState | null> => {
  // The common navbar/layout query stays lean: it never selects the (large)
  // Airtable payload, only the latest application's id so we can fetch the
  // payload separately if — and only if — the onboarding check needs it.
  const row = (await sql<AccessStateRow[]>`
    SELECT
      users.balance_cents,
      users.is_admin,
      users.manual_dashboard_state,
      users.country_code,
      users.ambassador_region,
      users.slack_id,
      users.display_name,
      latest_application.status AS latest_application_status,
      latest_application.id AS latest_application_id
    FROM users
    LEFT JOIN LATERAL (
      SELECT id, status
      FROM applications
      WHERE user_id = users.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest_application ON true
    WHERE users.id = ${userId}
    LIMIT 1
  `).at(0) ?? null;

  if (row === null) {
    return null;
  }

  const { latest_application_id, ...user } = row;

  if (!hasApprovedAmbassadorStatus({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
  })) {
    return { ...user, is_onboarding_complete: false };
  }

  // Only approved ambassadors reach the Airtable-backed onboarding check, the
  // sole reader of the payload — so the payload read happens only here.
  const application = latest_application_id === null
    ? null
    : (await sql<{ airtable_record_id: string | null; airtable_payload: unknown }[]>`
        SELECT airtable_record_id, airtable_payload
        FROM applications
        WHERE id = ${latest_application_id}
        LIMIT 1
      `).at(0) ?? null;

  const onboardingStatus = await getAmbassadorOnboardingStatus({
    applicationAirtableRecordId: application?.airtable_record_id ?? null,
    applicationAirtablePayload: application?.airtable_payload ?? null,
  });

  return {
    ...user,
    is_onboarding_complete: onboardingStatus.isOnboardingComplete,
  };
});

export function hasApprovedAmbassadorStatus(input: {
  latestApplicationStatus?: string | null;
  manualDashboardState?: string | null;
} | null | undefined) {
  const manualDashboardState = isUserManualDashboardState(input?.manualDashboardState)
    ? input.manualDashboardState
    : null;

  return (
    manualDashboardState === "approved" ||
    isAcceptedApplicationStatus(input?.latestApplicationStatus)
  );
}

export function canAccessPosters(input: {
  latestApplicationStatus?: string | null;
  manualDashboardState?: string | null;
  isOnboardingComplete?: boolean;
  isAdmin?: boolean;
} | null | undefined) {
  if (input?.isAdmin === true) {
    return true;
  }

  return hasApprovedAmbassadorStatus(input) && input?.isOnboardingComplete === true;
}
