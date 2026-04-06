import {
  buildPosterRedirectUrl,
  buildPosterReferralUrl,
  normalizeCampaignSlug,
} from "@/lib/posters/config";
import { generateMergedPosterGroupPdf, generatePosterPdfForRow } from "@/lib/posters/pdf";
import {
  createPoster,
  createPosterGroup,
  findPosterByReferralCode,
  findPosterForUser,
  findPosterGroupForUser,
  getGroupPosters,
  getUserPendingPosters,
  listUserPosterGroups,
  listUserPosters,
  recordPosterScan,
  updatePosterMetadata,
  updatePosterProofAndVerification,
} from "@/lib/posters/repository";
import { findMatchingPoster, getPosterReferralUrl, readQrCodesFromImageBuffer } from "@/lib/posters/qr";
import { deletePosterProofFile, savePosterProofFile } from "@/lib/posters/storage";
import { PosterRequestError } from "@/lib/posters/http";
import {
  MAX_POSTERS_PER_GROUP,
  POSTER_GROUP_CHARSETS,
  POSTER_STYLES,
  type CreatePosterGroupInput,
  type CreatePosterInput,
  type PosterGroupCharset,
  type PosterRow,
  type PosterStyle,
  type ScanMatchResult,
  type SubmitPosterProofInput,
} from "@/lib/posters/types";

function isPosterStyle(value: string | null | undefined): value is PosterStyle {
  return POSTER_STYLES.includes((value ?? "") as PosterStyle);
}

function isPosterGroupCharset(value: string | null | undefined): value is PosterGroupCharset {
  return POSTER_GROUP_CHARSETS.includes((value ?? "") as PosterGroupCharset);
}

function getProofUploadMetadata(detectedQrCodes: string[], extra: Record<string, unknown> = {}) {
  return {
    detected_qr_codes: detectedQrCodes,
    ...extra,
  };
}

async function toBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

async function persistPosterDecision(input: {
  poster: PosterRow;
  file: File;
  detectedQrCodes: string[];
  verificationStatus: PosterRow["verification_status"];
  locationDescription?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const stored = await savePosterProofFile(input.poster.id, input.file);

  try {
    return await updatePosterProofAndVerification({
      posterId: input.poster.id,
      proofPath: stored.relativePath,
      proofOriginalName: input.file.name || null,
      proofContentType: input.file.type || null,
      proofSizeBytes: stored.size,
      locationDescription: input.locationDescription,
      detectedQrCodes: input.detectedQrCodes,
      verificationStatus: input.verificationStatus,
      metadata: getProofUploadMetadata(input.detectedQrCodes, input.metadata),
      submittedAt: true,
      verifiedAt: input.verificationStatus === "success",
    });
  } catch (error) {
    await deletePosterProofFile(stored.relativePath);
    throw error;
  }
}

async function detectQrCodes(file: File) {
  return readQrCodesFromImageBuffer(await toBuffer(file));
}

export async function listPosterDataForUser(userId: string) {
  const [groups, posters] = await Promise.all([
    listUserPosterGroups(userId),
    listUserPosters(userId),
  ]);

  const groupedPosters = new Map<string, PosterRow[]>();
  const standalonePosters: PosterRow[] = [];

  for (const poster of posters) {
    if (poster.poster_group_id) {
      const existing = groupedPosters.get(poster.poster_group_id) ?? [];
      existing.push(poster);
      groupedPosters.set(poster.poster_group_id, existing);
    } else {
      standalonePosters.push(poster);
    }
  }

  return {
    groups: groups.map((group) => ({
      ...group,
      posters: groupedPosters.get(group.id) ?? [],
    })),
    standalonePosters,
  };
}

export async function createSinglePosterForUser(
  input: Omit<CreatePosterInput, "userId" | "campaignSlug" | "posterType" | "charset"> & {
    userId: string;
    campaignSlug?: string | null;
    posterType?: string | null;
    charset?: string | null;
  },
) {
  const campaignSlug = normalizeCampaignSlug(input.campaignSlug);
  const posterType = isPosterStyle(input.posterType) ? input.posterType : "color";
  const charset = isPosterGroupCharset(input.charset) ? input.charset : "alphanumeric";

  return createPoster({
    userId: input.userId,
    campaignSlug,
    posterType,
    charset,
    posterGroupId: null,
  });
}

export async function createPosterGroupForUser(
  input: Omit<
    CreatePosterGroupInput,
    "userId" | "campaignSlug" | "posterType" | "charset"
  > & {
    userId: string;
    campaignSlug?: string | null;
    posterType?: string | null;
    charset?: string | null;
  },
) {
  const count = Math.min(Math.max(input.count, 1), MAX_POSTERS_PER_GROUP);
  const campaignSlug = normalizeCampaignSlug(input.campaignSlug);
  const posterType = isPosterStyle(input.posterType) ? input.posterType : "color";
  const charset = isPosterGroupCharset(input.charset) ? input.charset : "alphanumeric";

  return createPosterGroup({
    userId: input.userId,
    campaignSlug,
    count,
    name: input.name ?? null,
    charset,
    posterType,
  });
}

export async function getPosterForUserOrThrow(userId: string, posterId: string) {
  const poster = await findPosterForUser(userId, posterId);
  if (!poster) {
    throw new PosterRequestError("Poster not found.", 404);
  }
  return poster;
}

export async function getPosterGroupForUserOrThrow(userId: string, groupId: string) {
  const group = await findPosterGroupForUser(userId, groupId);
  if (!group) {
    throw new PosterRequestError("Poster group not found.", 404);
  }
  const posters = await getGroupPosters(group.id);
  return { group, posters };
}

export async function getPosterPdfForUser(userId: string, posterId: string) {
  const poster = await getPosterForUserOrThrow(userId, posterId);
  return {
    poster,
    pdf: await generatePosterPdfForRow(poster),
  };
}

export async function getPosterGroupPdfForUser(userId: string, groupId: string) {
  const { group, posters } = await getPosterGroupForUserOrThrow(userId, groupId);
  return {
    group,
    posters,
    pdf: await generateMergedPosterGroupPdf(posters),
  };
}

export async function submitPosterProof(input: SubmitPosterProofInput): Promise<ScanMatchResult> {
  const poster = await getPosterForUserOrThrow(input.userId, input.posterId);
  const detectedQrCodes = await detectQrCodes(input.file);

  const currentPosterMatches = findMatchingPoster(detectedQrCodes, [poster]);

  if (poster.verification_status === "success") {
    return {
      status: "already_verified",
      detectedQrCodes,
      poster,
      message: "This poster is already approved.",
    };
  }

  if (currentPosterMatches) {
    const approvedPoster = await persistPosterDecision({
      poster,
      file: input.file,
      detectedQrCodes,
      verificationStatus: "success",
      locationDescription: input.locationDescription,
      metadata: {
        auto_verified: true,
        expected_url: getPosterReferralUrl(poster),
      },
    });

    return {
      status: "success",
      detectedQrCodes,
      poster: approvedPoster,
      message: "Poster verified automatically.",
    };
  }

  const userPendingPosters = await getUserPendingPosters(input.userId, poster.campaign_slug, poster.id);
  const matchedPoster = findMatchingPoster(detectedQrCodes, userPendingPosters);

  if (matchedPoster) {
    const approvedPoster = await persistPosterDecision({
      poster: matchedPoster,
      file: input.file,
      detectedQrCodes,
      verificationStatus: "success",
      locationDescription: input.locationDescription,
      metadata: {
        auto_verified: true,
        auto_matched_from_poster_id: poster.id,
        expected_url: getPosterReferralUrl(matchedPoster),
      },
    });

    await updatePosterMetadata(poster.id, {
      proof_transferred_to_poster_id: matchedPoster.id,
      auto_match_transfer_at: new Date().toISOString(),
      detected_qr_codes: detectedQrCodes,
    });

    return {
      status: "auto_matched",
      detectedQrCodes,
      poster,
      matchedPoster: approvedPoster,
      message: "Matched this upload to one of your other posters and approved it.",
    };
  }

  const reviewPoster = await persistPosterDecision({
    poster,
    file: input.file,
    detectedQrCodes,
    verificationStatus: "in_review",
    locationDescription: input.locationDescription,
    metadata: {
      auto_verification_result: detectedQrCodes.length === 0 ? "qr_not_found" : "no_match",
      expected_url: buildPosterReferralUrl(poster.referral_code),
    },
  });

  return {
    status: "in_review",
    detectedQrCodes,
    poster: reviewPoster,
    message:
      detectedQrCodes.length === 0
        ? "No QR code was detected, so this proof was sent to review."
        : "QR detected, but it did not match your pending posters. Sent to review.",
  };
}

export async function scanPosterGroupProof(input: {
  userId: string;
  groupId: string;
  file: File;
  locationDescription?: string | null;
}): Promise<ScanMatchResult> {
  const { posters } = await getPosterGroupForUserOrThrow(input.userId, input.groupId);
  const pendingGroupPosters = posters.filter((poster) => poster.verification_status === "pending");
  const detectedQrCodes = await detectQrCodes(input.file);

  if (detectedQrCodes.length === 0) {
    return {
      status: "no_qr",
      detectedQrCodes,
      message: "No valid QR code detected in the image.",
    };
  }

  const matchedInGroup = findMatchingPoster(detectedQrCodes, pendingGroupPosters);
  if (matchedInGroup) {
    return submitPosterProof({
      userId: input.userId,
      posterId: matchedInGroup.id,
      file: input.file,
      locationDescription: input.locationDescription,
    });
  }

  const otherPendingPosters = await getUserPendingPosters(input.userId);
  const matchedOutsideGroup = findMatchingPoster(
    detectedQrCodes,
    otherPendingPosters.filter((poster) => poster.poster_group_id !== input.groupId),
  );

  if (matchedOutsideGroup) {
    return {
      status: "wrong_group",
      detectedQrCodes,
      matchedPoster: matchedOutsideGroup,
      message: "This QR code belongs to a different poster group or standalone poster.",
    };
  }

  const fallbackPoster = pendingGroupPosters[0] ?? null;
  if (!fallbackPoster) {
    return {
      status: "no_match",
      detectedQrCodes,
      message: "QR detected, but there are no pending posters left in this group.",
    };
  }

  const reviewPoster = await persistPosterDecision({
    poster: fallbackPoster,
    file: input.file,
    detectedQrCodes,
    verificationStatus: "in_review",
    locationDescription: input.locationDescription,
    metadata: {
      auto_verification_result: "group_no_match",
      expected_url: buildPosterReferralUrl(fallbackPoster.referral_code),
    },
  });

  return {
    status: "in_review",
    detectedQrCodes,
    poster: reviewPoster,
    message: "QR detected, but it does not match this group. Sent to review.",
  };
}

export async function scanAnyUserPoster(input: {
  userId: string;
  file: File;
  locationDescription?: string | null;
}): Promise<ScanMatchResult> {
  const posters = await getUserPendingPosters(input.userId);
  const detectedQrCodes = await detectQrCodes(input.file);

  if (detectedQrCodes.length === 0) {
    return {
      status: "no_qr",
      detectedQrCodes,
      message: "No valid QR code detected in the image.",
    };
  }

  const matchedPoster = findMatchingPoster(detectedQrCodes, posters);
  if (!matchedPoster) {
    return {
      status: "no_match",
      detectedQrCodes,
      message: "QR detected, but it does not match any of your pending posters.",
    };
  }

  return submitPosterProof({
    userId: input.userId,
    posterId: matchedPoster.id,
    file: input.file,
    locationDescription: input.locationDescription,
  });
}

export async function readPosterQrCodes(file: File) {
  return detectQrCodes(file);
}

export async function resolvePublicPosterScan(code: string, requestInfo: {
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}) {
  const poster = await findPosterByReferralCode(code);
  if (!poster) {
    return null;
  }

  await recordPosterScan({
    posterId: poster.id,
    ipAddress: requestInfo.ipAddress,
    userAgent: requestInfo.userAgent,
    referrer: requestInfo.referrer,
    metadata: {
      referral_code: poster.referral_code,
      campaign_slug: poster.campaign_slug,
    },
  });

  return {
    poster,
    redirectUrl: buildPosterRedirectUrl(poster.referral_code, poster.campaign_slug),
  };
}
