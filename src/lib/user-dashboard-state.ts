type Translate = (key: string, values?: Record<string, number | string>) => string;

export type UserManualDashboardState = "approved" | "rejected" | "banned";

export function isUserManualDashboardState(
  value: string | null | undefined,
): value is UserManualDashboardState {
  return value === "approved" || value === "rejected" || value === "banned";
}

export function getUserManualDashboardStateLabel(
  t: Translate,
  value: UserManualDashboardState,
) {
  if (value === "approved") return t("status.approved");
  if (value === "rejected") return t("status.rejected");
  return t("status.rejected-permanent");
}
