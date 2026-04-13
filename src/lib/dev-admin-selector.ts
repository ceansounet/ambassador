export type DevState =
  | "apply"
  | "ineligible"
  | "pending-checks"
  | "pending"
  | "approved"
  | "rejected"
  | "banned";
export type ErrorCode = "401" | "403" | "404" | "500";

export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

export function canShowDevAdminSelector(isAdmin: boolean) {
  return isDevelopmentEnvironment || isAdmin;
}

export function isDevState(value: string): value is DevState {
  return value === "apply" || value === "ineligible" || value === "pending-checks" || value === "pending" || value === "approved" || value === "rejected" || value === "banned";
}

export function isErrorCode(value: string): value is ErrorCode {
  return value === "401" || value === "403" || value === "404" || value === "500";
}
