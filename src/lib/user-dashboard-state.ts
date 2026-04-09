type Translate = (key: string, values?: Record<string, number | string>) => string;

export const USER_MANUAL_DASHBOARD_STATES = [
  "approved",
  "rejected",
  "banned",
] as const;

export type UserManualDashboardState =
  (typeof USER_MANUAL_DASHBOARD_STATES)[number];

export function isUserManualDashboardState(
  value: string | null | undefined,
): value is UserManualDashboardState {
  return USER_MANUAL_DASHBOARD_STATES.includes(
    value as UserManualDashboardState,
  );
}

export function getUserManualDashboardStateLabel(
  t: Translate,
  value: UserManualDashboardState,
) {
  if (value === "approved") return t("status.approved");
  if (value === "rejected") return t("status.rejected");
  return t("status.rejected-permanent");
}
