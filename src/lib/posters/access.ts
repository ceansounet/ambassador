import sql from "@/lib/database/client";
import { isAcceptedApplicationStatus } from "@/lib/applications/status";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

export type PosterAccessState = {
  balance_cents?: number | null;
  is_admin?: boolean | null;
  posters_enabled?: boolean | null;
  manual_dashboard_state?: string | null;
  latest_application_status?: string | null;
};

export async function getPosterAccessState(userId: string): Promise<PosterAccessState | null> {
  const [user] = await sql<PosterAccessState[]>`
    SELECT balance_cents, is_admin, posters_enabled, manual_dashboard_state,
           (
             SELECT status
             FROM applications
             WHERE user_id = users.id
             ORDER BY created_at DESC, id DESC
             LIMIT 1
           ) AS latest_application_status
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return user ?? null;
}

export function canAccessPosters(input: {
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
