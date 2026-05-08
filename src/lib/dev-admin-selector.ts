export type DevState =
  | "apply"
  | "ineligible"
  | "pending-checks"
  | "pending"
  | "approved"
  | "accepted-not-onboarded"
  | "accepted-onboarding-submitted"
  | "accepted-pending-signature"
  | "accepted-onboarding-completed"
  | "accepted-grant-failed"
  | "rejected"
  | "banned";
export type ErrorCode = "401" | "403" | "404" | "500";

export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

export function canShowDevAdminSelector(isAdmin: boolean) {
  return isDevelopmentEnvironment || isAdmin;
}

export function isDevState(value: string): value is DevState {
  return (
    value === "apply" ||
    value === "ineligible" ||
    value === "pending-checks" ||
    value === "pending" ||
    value === "approved" ||
    value === "accepted-not-onboarded" ||
    value === "accepted-onboarding-submitted" ||
    value === "accepted-pending-signature" ||
    value === "accepted-onboarding-completed" ||
    value === "accepted-grant-failed" ||
    value === "rejected" ||
    value === "banned"
  );
}

export function isErrorCode(value: string): value is ErrorCode {
  return value === "401" || value === "403" || value === "404" || value === "500";
}
