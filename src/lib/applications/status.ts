type Translate = (key: string, values?: Record<string, number | string>) => string;

export const APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS =
  "Pending Automatic Checks";
export const APPLICATION_STATUS_PENDING_REVIEW = "Pending Review";
export const APPLICATION_STATUS_ACCEPTED = "Accepted";
export const APPLICATION_STATUS_REJECTED = "Rejected";
export const APPLICATION_STATUS_REJECTED_PERMANENT = "Rejected Permenant";
export const APPLICATION_STATUS_REJECTED_PERMENANT = APPLICATION_STATUS_REJECTED_PERMANENT;

const LEGACY_APPLICATION_STATUS_REJECTED_PERMANENT = "Rejected Permanent";

export const APPLICATION_STATUS_VALUES = [
  APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS,
  APPLICATION_STATUS_PENDING_REVIEW,
  APPLICATION_STATUS_ACCEPTED,
  APPLICATION_STATUS_REJECTED,
  APPLICATION_STATUS_REJECTED_PERMANENT,
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS_VALUES)[number];

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
  if (!status) return null;

  if (status in legacyApplicationStatusMap) {
    return legacyApplicationStatusMap[
      status as keyof typeof legacyApplicationStatusMap
    ];
  }

  return APPLICATION_STATUS_VALUES.includes(status as ApplicationStatus)
    ? (status as ApplicationStatus)
    : null;
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

export function isTerminalApplicationStatus(status: string | null | undefined) {
  return (
    isAcceptedApplicationStatus(status) ||
    isRejectedApplicationStatus(status) ||
    isRejectedPermanentlyApplicationStatus(status)
  );
}

export function getApplicationStatusMeta(t: Translate) {
  return {
    [APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS]: {
      label: t("status.pending-automatic-checks"),
      className: "bg-secondary text-black",
    },
    [APPLICATION_STATUS_PENDING_REVIEW]: {
      label: t("status.pending-review"),
      className: "bg-secondary text-black",
    },
    [APPLICATION_STATUS_ACCEPTED]: {
      label: t("status.accepted"),
      className: "bg-acceptance text-black",
    },
    [APPLICATION_STATUS_REJECTED]: {
      label: t("status.rejected"),
      className: "bg-secondary text-black",
    },
    [APPLICATION_STATUS_REJECTED_PERMANENT]: {
      label: t("status.rejected-permanent"),
      className: "bg-rejection text-white",
    },
  } as const;
}
