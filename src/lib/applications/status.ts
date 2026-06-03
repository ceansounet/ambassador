type Translate = (key: string, values?: Record<string, number | string>) => string;

export const APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS =
  "Pending Automatic Checks";
export const APPLICATION_STATUS_PENDING_REVIEW = "Pending Review";
export const APPLICATION_STATUS_ACCEPTED = "Accepted";
export const APPLICATION_STATUS_REJECTED = "Rejected";
export const APPLICATION_STATUS_REJECTED_PERMANENT = "Rejected Permenant";

const LEGACY_APPLICATION_STATUS_REJECTED_PERMANENT = "Rejected Permanent";

export type ApplicationStatus =
  | typeof APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS
  | typeof APPLICATION_STATUS_PENDING_REVIEW
  | typeof APPLICATION_STATUS_ACCEPTED
  | typeof APPLICATION_STATUS_REJECTED
  | typeof APPLICATION_STATUS_REJECTED_PERMANENT;

const legacyApplicationStatusMap = {
  pending: APPLICATION_STATUS_PENDING_REVIEW,
  approved: APPLICATION_STATUS_ACCEPTED,
  rejected: APPLICATION_STATUS_REJECTED,
  rejected_permanently: APPLICATION_STATUS_REJECTED_PERMANENT,
  rejected_permenant: APPLICATION_STATUS_REJECTED_PERMANENT,
  [LEGACY_APPLICATION_STATUS_REJECTED_PERMANENT]:
    APPLICATION_STATUS_REJECTED_PERMANENT,
} as const;

export function normalizeApplicationStatus(
  status: string | null | undefined,
): ApplicationStatus | null {
  if (status === null || status === undefined || status === "") return null;

  switch (status) {
    case "pending":
      return legacyApplicationStatusMap.pending;
    case "approved":
      return legacyApplicationStatusMap.approved;
    case "rejected":
      return legacyApplicationStatusMap.rejected;
    case "rejected_permanently":
      return legacyApplicationStatusMap.rejected_permanently;
    case "rejected_permenant":
      return legacyApplicationStatusMap.rejected_permenant;
    case LEGACY_APPLICATION_STATUS_REJECTED_PERMANENT:
      return legacyApplicationStatusMap[LEGACY_APPLICATION_STATUS_REJECTED_PERMANENT];
    case APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS:
    case APPLICATION_STATUS_PENDING_REVIEW:
    case APPLICATION_STATUS_ACCEPTED:
    case APPLICATION_STATUS_REJECTED:
    case APPLICATION_STATUS_REJECTED_PERMANENT:
      return status;
    default:
      return null;
  }
}

export function isPendingApplicationStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeApplicationStatus(status);

  return (
    normalizedStatus === APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS ||
    normalizedStatus === APPLICATION_STATUS_PENDING_REVIEW
  );
}

export function isAcceptedApplicationStatus(status: string | null | undefined) {
  return normalizeApplicationStatus(status) === APPLICATION_STATUS_ACCEPTED;
}

export function isRejectedApplicationStatus(status: string | null | undefined) {
  return normalizeApplicationStatus(status) === APPLICATION_STATUS_REJECTED;
}

export function isRejectedPermanentlyApplicationStatus(
  status: string | null | undefined,
) {
  return normalizeApplicationStatus(status) === APPLICATION_STATUS_REJECTED_PERMANENT;
}

export function canChangeApplicationReviewStatus(
  currentStatus: string | null | undefined,
  nextStatus: ApplicationStatus,
) {
  return normalizeApplicationStatus(currentStatus) !== nextStatus;
}

export function getApplicationStatusMeta(t: Translate) {
  return {
    [APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS]: {
      label: t("status.pending-automatic-checks"),
      tone: "black",
    },
    [APPLICATION_STATUS_PENDING_REVIEW]: {
      label: t("status.pending-review"),
      tone: "black",
    },
    [APPLICATION_STATUS_ACCEPTED]: {
      label: t("status.accepted"),
      tone: "green",
    },
    [APPLICATION_STATUS_REJECTED]: {
      label: t("status.rejected"),
      tone: "red",
    },
    [APPLICATION_STATUS_REJECTED_PERMANENT]: {
      label: t("status.rejected-permanent"),
      tone: "red",
    },
  } as const;
}
