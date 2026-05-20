import { isAcceptedApplicationStatus } from "@/lib/applications/status";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

export function canAccessShirts(input: {
  latestApplicationStatus?: string | null;
  manualDashboardState?: string | null;
  isAdmin?: boolean;
} | null | undefined) {
  if (input?.isAdmin === true) {
    return true;
  }

  const manualDashboardState = isUserManualDashboardState(input?.manualDashboardState)
    ? input.manualDashboardState
    : null;

  return (
    manualDashboardState === "approved" ||
    isAcceptedApplicationStatus(input?.latestApplicationStatus)
  );
}
