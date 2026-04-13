export type DevState =
  | "apply"
  | "ineligible"
  | "pending-checks"
  | "pending"
  | "approved"
  | "rejected"
  | "banned";
export type ErrorCode = "401" | "403" | "404" | "500";

const DEV_STATES: ReadonlySet<DevState> = new Set([
  "apply",
  "ineligible",
  "pending-checks",
  "pending",
  "approved",
  "rejected",
  "banned",
]);
const ERROR_CODES: ReadonlySet<ErrorCode> = new Set(["401", "403", "404", "500"]);

export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

export function canShowDevAdminSelector(isAdmin: boolean) {
  return isDevelopmentEnvironment || isAdmin;
}

export function isDevState(value: string): value is DevState {
  return DEV_STATES.has(value as DevState);
}

export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODES.has(value as ErrorCode);
}
