import sql from "@/lib/database/client";
import type {
  CreatePosterGroupInput,
  CreatePosterInput,
  PosterGroupCharset,
  PosterGroupRow,
  PosterMetadata,
  PosterRow,
  PosterVerificationStatus,
} from "@/lib/posters/types";

async function referralCodeExists(candidate: string) {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM posters WHERE referral_code = ${candidate}
    ) AS exists
  `;

  return row?.exists ?? false;
}

async function qrTokenExists(candidate: string) {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM posters WHERE qr_code_token = ${candidate}
    ) AS exists
  `;

  return row?.exists ?? false;
}

function randomFromCharset(charset: string, length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => charset[byte % charset.length]).join("");
}

async function generateUniqueReferralCode(charset: PosterGroupCharset) {
  const alphabet =
    charset === "numeric"
      ? "0123456789"
      : charset === "alpha"
        ? "ABCDEFGHJKLMNPQRSTUVWXYZ"
        : "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = randomFromCharset(alphabet, 8);
    if (!(await referralCodeExists(candidate))) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique referral code.");
}

async function generateUniqueQrToken() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = crypto.randomUUID().replace(/-/g, "");
    if (!(await qrTokenExists(candidate))) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique QR token.");
}

export async function createPoster(input: CreatePosterInput) {
  const posterType = input.posterType ?? "color";
  const charset = input.charset ?? "alphanumeric";
  const id = crypto.randomUUID();
  const referralCode = await generateUniqueReferralCode(charset);
  const qrCodeToken = await generateUniqueQrToken();

  const [poster] = await sql<PosterRow[]>`
    INSERT INTO posters (
      id,
      user_id,
      poster_group_id,
      campaign_slug,
      qr_code_token,
      referral_code,
      poster_type,
      verification_status
    )
    VALUES (
      ${id},
      ${input.userId},
      ${input.posterGroupId ?? null},
      ${input.campaignSlug},
      ${qrCodeToken},
      ${referralCode},
      ${posterType},
      'pending'
    )
    RETURNING *
  `;

  return poster;
}

export async function createPosterGroup(input: CreatePosterGroupInput) {
  return sql.begin(async (tx) => {
    const id = crypto.randomUUID();
    const charset = input.charset ?? "alphanumeric";
    const posterType = input.posterType ?? "color";

    const [group] = await tx<PosterGroupRow[]>`
      INSERT INTO poster_groups (
        id,
        user_id,
        campaign_slug,
        name,
        charset,
        metadata
      )
      VALUES (
        ${id},
        ${input.userId},
        ${input.campaignSlug},
        ${input.name ?? null},
        ${charset},
        CAST(${JSON.stringify({})} AS JSONB)
      )
      RETURNING *
    `;

    const posters: PosterRow[] = [];
    for (let index = 0; index < input.count; index += 1) {
      const posterId = crypto.randomUUID();
      const referralCode = await generateUniqueReferralCode(charset);
      const qrCodeToken = await generateUniqueQrToken();
      const [poster] = await tx<PosterRow[]>`
        INSERT INTO posters (
          id,
          user_id,
          poster_group_id,
          campaign_slug,
          qr_code_token,
          referral_code,
          poster_type,
          verification_status
        )
        VALUES (
          ${posterId},
          ${input.userId},
          ${group.id},
          ${input.campaignSlug},
          ${qrCodeToken},
          ${referralCode},
          ${posterType},
          'pending'
        )
        RETURNING *
      `;
      posters.push(poster);
    }

    const [updatedGroup] = await tx<PosterGroupRow[]>`
      UPDATE poster_groups
      SET poster_count = ${posters.length}, updated_at = NOW()
      WHERE id = ${group.id}
      RETURNING *
    `;

    return { group: updatedGroup, posters };
  });
}

export async function listUserPosterGroups(userId: string) {
  return sql<PosterGroupRow[]>`
    SELECT *
    FROM poster_groups
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}

export async function listUserPosters(userId: string) {
  return sql<PosterRow[]>`
    SELECT *
    FROM posters
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}

export async function findPosterForUser(userId: string, posterId: string) {
  const [poster] = await sql<PosterRow[]>`
    SELECT *
    FROM posters
    WHERE id = ${posterId} AND user_id = ${userId}
    LIMIT 1
  `;

  return poster ?? null;
}

export async function findPosterGroupForUser(userId: string, groupId: string) {
  const [group] = await sql<PosterGroupRow[]>`
    SELECT *
    FROM poster_groups
    WHERE id = ${groupId} AND user_id = ${userId}
    LIMIT 1
  `;

  return group ?? null;
}

export async function findPosterByReferralCode(referralCode: string) {
  const [poster] = await sql<PosterRow[]>`
    SELECT *
    FROM posters
    WHERE referral_code = ${referralCode.toUpperCase()}
    LIMIT 1
  `;

  return poster ?? null;
}

export async function getGroupPosters(groupId: string) {
  return sql<PosterRow[]>`
    SELECT *
    FROM posters
    WHERE poster_group_id = ${groupId}
    ORDER BY created_at ASC
  `;
}

export async function getUserPendingPosters(userId: string, campaignSlug?: string, excludeId?: string) {
  return sql<PosterRow[]>`
    SELECT *
    FROM posters
    WHERE user_id = ${userId}
      AND verification_status = 'pending'
      ${campaignSlug ? sql`AND campaign_slug = ${campaignSlug}` : sql``}
      ${excludeId ? sql`AND id != ${excludeId}` : sql``}
    ORDER BY created_at ASC
  `;
}

export async function updatePosterProofAndVerification(input: {
  posterId: string;
  proofPath: string;
  proofOriginalName: string | null;
  proofContentType: string | null;
  proofSizeBytes: number;
  locationDescription?: string | null;
  detectedQrCodes: string[];
  verificationStatus: PosterVerificationStatus;
  metadata?: PosterMetadata;
  submittedAt?: boolean;
  verifiedAt?: boolean;
}) {
  const [poster] = await sql<PosterRow[]>`
    UPDATE posters
    SET
      proof_path = ${input.proofPath},
      proof_original_name = ${input.proofOriginalName},
      proof_content_type = ${input.proofContentType},
      proof_size_bytes = ${input.proofSizeBytes},
      location_description = COALESCE(${input.locationDescription ?? null}, location_description),
      detected_qr_codes = CAST(${JSON.stringify(input.detectedQrCodes)} AS JSONB),
      metadata = CAST(${JSON.stringify(input.metadata ?? {})} AS JSONB),
      verification_status = ${input.verificationStatus},
      submitted_at = CASE
        WHEN ${input.submittedAt ?? false} THEN NOW()
        ELSE submitted_at
      END,
      verified_at = CASE
        WHEN ${input.verifiedAt ?? false} THEN NOW()
        ELSE verified_at
      END,
      updated_at = NOW()
    WHERE id = ${input.posterId}
    RETURNING *
  `;

  return poster;
}

export async function updatePosterMetadata(posterId: string, metadata: PosterMetadata) {
  const [poster] = await sql<PosterRow[]>`
    UPDATE posters
    SET metadata = CAST(${JSON.stringify(metadata)} AS JSONB), updated_at = NOW()
    WHERE id = ${posterId}
    RETURNING *
  `;

  return poster;
}

export async function recordPosterScan(input: {
  posterId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  metadata?: PosterMetadata;
}) {
  await sql`
    INSERT INTO poster_scans (
      id,
      poster_id,
      ip_address,
      user_agent,
      referrer,
      metadata
    )
    VALUES (
      ${crypto.randomUUID()},
      ${input.posterId},
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null},
      ${input.referrer ?? null},
      CAST(${JSON.stringify(input.metadata ?? {})} AS JSONB)
    )
  `;
}
