import "server-only";

import { isAcceptedApplicationStatus } from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { optionalEnv } from "@/lib/env";
import { ensurePosterNameColumn } from "@/lib/posters/repository";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 5;
const CODE_PATTERN = /^[a-z0-9]{5}$/;
const STARDANCE_BASE_URL = "https://stardance.hackclub.com";
const DEFAULT_STARDANCE_REFERRAL_LABEL = "Default";
const MAX_STARDANCE_REFERRAL_LABEL_LENGTH = 80;

let ensureLowercaseReferralCodesPromise: Promise<void> | null = null;

type StardanceUserCodeRow = {
  stardance_referral_code: string | null;
};

export type StardanceReferralVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type StardanceReferralCodeKind = "primary" | "secondary";

export type StardanceReferralCodeRow = {
  id: string;
  user_id: string;
  code: string;
  label: string;
  kind: StardanceReferralCodeKind;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type StardanceReferralCode = {
  id: string;
  code: string;
  label: string;
  kind: StardanceReferralCodeKind;
  shareUrl: string;
  archivedAt: string | null;
  usesCount: number;
};

export type StardanceReferral = {
  id: string;
  kind: "signup" | "poster";
  name: string;
  slackId: string;
  email: string;
  hoursLogged: number;
  hoursApproved: number;
  verificationStatus: StardanceReferralVerificationStatus;
  referredAt: string;
  referralCodeId: string;
  referralCodeLabel: string;
  posterId: string | null;
  posterName: string | null;
};

export class StardanceReferralCodeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StardanceReferralCodeError";
  }
}

export function isStardanceReferralCode(value: unknown): value is string {
  return normalizeStardanceReferralCode(value) !== null;
}

function normalizeStardanceReferralCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

async function ensureLowercaseReferralCodes() {
  ensureLowercaseReferralCodesPromise ??= (async () => {
    await sql`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_stardance_referral_code_format
    `;

    await sql`
      ALTER TABLE stardance_referral_codes
      DROP CONSTRAINT IF EXISTS stardance_referral_codes_code_format
    `;

    await sql`
      UPDATE users
      SET stardance_referral_code = LOWER(stardance_referral_code)
      WHERE stardance_referral_code IS NOT NULL
    `;

    await sql`
      UPDATE stardance_referral_codes
      SET code = LOWER(code)
    `;

    await sql`
      UPDATE posters
      SET referral_code = LOWER(referral_code)
      WHERE referral_code ~ '^[A-Z0-9]{5}$'
    `;

    await sql`
      ALTER TABLE users
      ADD CONSTRAINT users_stardance_referral_code_format
        CHECK (stardance_referral_code IS NULL OR stardance_referral_code ~ '^[a-z0-9]{5}$')
    `;

    await sql`
      ALTER TABLE stardance_referral_codes
      ADD CONSTRAINT stardance_referral_codes_code_format
        CHECK (code ~ '^[a-z0-9]{5}$')
    `;
  })().catch((error) => {
    ensureLowercaseReferralCodesPromise = null;
    throw error;
  });

  return ensureLowercaseReferralCodesPromise;
}

export function canAccessStardanceReferrals(input: {
  latestApplicationStatus?: string | null;
  manualDashboardState?: string | null;
} | null | undefined) {
  const manualDashboardState = isUserManualDashboardState(input?.manualDashboardState)
    ? input.manualDashboardState
    : null;

  return (
    manualDashboardState === "approved" ||
    isAcceptedApplicationStatus(input?.latestApplicationStatus)
  );
}

export function buildStardanceReferralUrl(code: string) {
  return `${optionalEnv("STARDANCE_REFERRAL_BASE_URL") ?? STARDANCE_BASE_URL}/a-${code.toLowerCase()}`;
}

function toStardanceReferralCode(
  row: StardanceReferralCodeRow,
  usesCount = 0,
): StardanceReferralCode {
  const code = row.code.toLowerCase();
  return {
    id: row.id,
    code,
    label: row.label,
    kind: row.kind,
    shareUrl: buildStardanceReferralUrl(code),
    archivedAt: row.archived_at?.toISOString() ?? null,
    usesCount,
  };
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";

  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }

  return code;
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = randomCode();

    const existing = (await sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM stardance_referral_codes WHERE LOWER(code) = ${candidate}
        UNION ALL
        SELECT 1 FROM users WHERE LOWER(stardance_referral_code) = ${candidate}
        UNION ALL
        SELECT 1 FROM posters WHERE LOWER(referral_code) = ${candidate}
        UNION ALL
        SELECT 1 FROM referral_links WHERE LOWER(code) = ${candidate}
      ) AS exists
    `).at(0);

    if (existing?.exists !== true) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique Stardance referral code.");
}

async function getOrCreateDefaultStardanceReferralCodeRow(userId: string) {
  await ensureLowercaseReferralCodes();

  return sql.begin(async (transaction) => {
    const lockedUser = (await transaction<StardanceUserCodeRow[]>`
      SELECT stardance_referral_code
      FROM users
      WHERE id = ${userId}
      LIMIT 1
      FOR UPDATE
    `).at(0);

    if (lockedUser === undefined) {
      throw new Error(`User ${userId} not found.`);
    }

    const existingPrimary = (await transaction<StardanceReferralCodeRow[]>`
      SELECT *
      FROM stardance_referral_codes
      WHERE user_id = ${userId}
        AND kind = 'primary'
      LIMIT 1
    `).at(0);

    if (existingPrimary !== undefined) {
      const existingPrimaryCode = existingPrimary.code.toLowerCase();
      if (lockedUser.stardance_referral_code !== existingPrimaryCode) {
        await transaction`
          UPDATE users
          SET stardance_referral_code = ${existingPrimaryCode}
          WHERE id = ${userId}
        `;
      }

      return { ...existingPrimary, code: existingPrimaryCode };
    }

    const currentCode = normalizeStardanceReferralCode(lockedUser.stardance_referral_code);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate =
        attempt === 0 && currentCode !== null
          ? currentCode
          : await generateUniqueCode();

      const [created] = await transaction<StardanceReferralCodeRow[]>`
        INSERT INTO stardance_referral_codes (id, user_id, code, label, kind)
        VALUES (
          ${crypto.randomUUID()},
          ${userId},
          ${candidate},
          ${DEFAULT_STARDANCE_REFERRAL_LABEL},
          'primary'
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `;

      if (created !== undefined) {
        const createdCode = created.code.toLowerCase();
        if (lockedUser.stardance_referral_code !== createdCode) {
          await transaction`
            UPDATE users
            SET stardance_referral_code = ${createdCode}
            WHERE id = ${userId}
          `;
        }

        return { ...created, code: createdCode };
      }

      const raced = (await transaction<StardanceReferralCodeRow[]>`
        SELECT *
        FROM stardance_referral_codes
        WHERE user_id = ${userId}
          AND kind = 'primary'
        LIMIT 1
      `).at(0);

      if (raced !== undefined) {
        const racedCode = raced.code.toLowerCase();
        if (lockedUser.stardance_referral_code !== racedCode) {
          await transaction`
            UPDATE users
            SET stardance_referral_code = ${racedCode}
            WHERE id = ${userId}
          `;
        }

        return { ...raced, code: racedCode };
      }
    }

    throw new Error("Failed to assign a Stardance referral code.");
  });
}

export async function getOrCreateStardanceReferralCode(userId: string) {
  const defaultCode = await getOrCreateDefaultStardanceReferralCodeRow(userId);
  return defaultCode.code;
}

async function countUsesByCodeId(userId: string) {
  const rows = await sql<{ referral_code_id: string; count: string }[]>`
    SELECT referral_code_id, COUNT(*)::text AS count
    FROM stardance_referrals
    WHERE user_id = ${userId}
    GROUP BY referral_code_id
  `;

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.referral_code_id, Number.parseInt(row.count, 10));
  }
  return map;
}

export async function listStardanceReferralCodesForUser(userId: string) {
  await getOrCreateDefaultStardanceReferralCodeRow(userId);

  const rows = await sql<StardanceReferralCodeRow[]>`
    SELECT *
    FROM stardance_referral_codes
    WHERE user_id = ${userId}
      AND archived_at IS NULL
    ORDER BY
      CASE WHEN kind = 'primary' THEN 0 ELSE 1 END,
      created_at ASC,
      id ASC
  `;

  const uses = await countUsesByCodeId(userId);
  return rows.map((row) => toStardanceReferralCode(row, uses.get(row.id) ?? 0));
}

export async function listArchivedStardanceReferralCodesForUser(userId: string) {
  const rows = await sql<StardanceReferralCodeRow[]>`
    SELECT *
    FROM stardance_referral_codes
    WHERE user_id = ${userId}
      AND archived_at IS NOT NULL
    ORDER BY archived_at DESC, id ASC
  `;

  const uses = await countUsesByCodeId(userId);
  return rows.map((row) => toStardanceReferralCode(row, uses.get(row.id) ?? 0));
}

export async function restoreStardanceReferralCodeForUser(userId: string, codeId: string) {
  const [existing] = await sql<StardanceReferralCodeRow[]>`
    SELECT *
    FROM stardance_referral_codes
    WHERE id = ${codeId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (existing === undefined) {
    throw new StardanceReferralCodeError("Referral code not found.", 404);
  }

  if (existing.archived_at === null) {
    return toStardanceReferralCode(existing);
  }

  const [activeCountRow] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM stardance_referral_codes
    WHERE user_id = ${userId} AND archived_at IS NULL
  `;

  if (activeCountRow !== undefined && Number.parseInt(activeCountRow.count, 10) >= 100) {
    throw new StardanceReferralCodeError(
      "You can have at most 100 active referral codes. Delete one to free up space.",
      400,
    );
  }

  const duplicateLabel = (await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1
      FROM stardance_referral_codes
      WHERE user_id = ${userId}
        AND id <> ${codeId}
        AND archived_at IS NULL
        AND LOWER(label) = LOWER(${existing.label})
    ) AS exists
  `).at(0);

  if (duplicateLabel?.exists === true) {
    throw new StardanceReferralCodeError(
      "An active referral code already uses that label. Rename it first.",
      409,
    );
  }

  const [restored] = await sql<StardanceReferralCodeRow[]>`
    UPDATE stardance_referral_codes
    SET archived_at = NULL, updated_at = NOW()
    WHERE id = ${codeId} AND user_id = ${userId}
    RETURNING *
  `;

  if (restored === undefined) {
    throw new StardanceReferralCodeError("Referral code not found.", 404);
  }

  return toStardanceReferralCode(restored);
}

export async function archiveStardanceReferralCodeForUser(userId: string, codeId: string) {
  const [existing] = await sql<StardanceReferralCodeRow[]>`
    SELECT *
    FROM stardance_referral_codes
    WHERE id = ${codeId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (existing === undefined) {
    throw new StardanceReferralCodeError("Referral code not found.", 404);
  }

  if (existing.kind === "primary") {
    throw new StardanceReferralCodeError("The default referral code cannot be archived.", 400);
  }

  if (existing.archived_at !== null) {
    return toStardanceReferralCode(existing);
  }

  const [archived] = await sql<StardanceReferralCodeRow[]>`
    UPDATE stardance_referral_codes
    SET archived_at = NOW(), updated_at = NOW()
    WHERE id = ${codeId} AND user_id = ${userId}
    RETURNING *
  `;

  if (archived === undefined) {
    throw new StardanceReferralCodeError("Referral code not found.", 404);
  }

  return toStardanceReferralCode(archived);
}

export async function renameStardanceReferralCodeForUser(
  userId: string,
  codeId: string,
  rawLabel: string,
) {
  const label = rawLabel.trim();

  if (label === "") {
    throw new StardanceReferralCodeError("Referral code label is required.", 400);
  }

  if (label.length > MAX_STARDANCE_REFERRAL_LABEL_LENGTH) {
    throw new StardanceReferralCodeError("Referral code labels must be 80 characters or fewer.", 400);
  }

  const [existing] = await sql<StardanceReferralCodeRow[]>`
    SELECT *
    FROM stardance_referral_codes
    WHERE id = ${codeId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (existing === undefined || existing.archived_at !== null) {
    throw new StardanceReferralCodeError("Referral code not found.", 404);
  }

  const duplicateLabel = (await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1
      FROM stardance_referral_codes
      WHERE user_id = ${userId}
        AND id <> ${codeId}
        AND archived_at IS NULL
        AND LOWER(label) = LOWER(${label})
    ) AS exists
  `).at(0);

  if (duplicateLabel?.exists === true) {
    throw new StardanceReferralCodeError("A referral code with that label already exists.", 409);
  }

  const [updated] = await sql<StardanceReferralCodeRow[]>`
    UPDATE stardance_referral_codes
    SET label = ${label}, updated_at = NOW()
    WHERE id = ${codeId} AND user_id = ${userId}
    RETURNING *
  `;

  if (updated === undefined) {
    throw new StardanceReferralCodeError("Referral code not found.", 404);
  }

  return toStardanceReferralCode(updated);
}

export async function createStardanceReferralCodeForUser(userId: string, rawLabel: string) {
  const label = rawLabel.trim();

  if (label === "") {
    throw new StardanceReferralCodeError("Referral code label is required.", 400);
  }

  if (label.length > MAX_STARDANCE_REFERRAL_LABEL_LENGTH) {
    throw new StardanceReferralCodeError("Referral code labels must be 80 characters or fewer.", 400);
  }

  await getOrCreateDefaultStardanceReferralCodeRow(userId);

  const [activeCountRow] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM stardance_referral_codes
    WHERE user_id = ${userId} AND archived_at IS NULL
  `;

  if (activeCountRow !== undefined && Number.parseInt(activeCountRow.count, 10) >= 100) {
    throw new StardanceReferralCodeError(
      "You can have at most 100 active referral codes. Delete one to free up space.",
      400,
    );
  }

  const duplicateLabel = (await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1
      FROM stardance_referral_codes
      WHERE user_id = ${userId}
        AND archived_at IS NULL
        AND LOWER(label) = LOWER(${label})
    ) AS exists
  `).at(0);

  if (duplicateLabel?.exists === true) {
    throw new StardanceReferralCodeError("A referral code with that label already exists.", 409);
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const [created] = await sql<StardanceReferralCodeRow[]>`
      INSERT INTO stardance_referral_codes (id, user_id, code, label, kind)
      VALUES (${crypto.randomUUID()}, ${userId}, ${await generateUniqueCode()}, ${label}, 'secondary')
      ON CONFLICT DO NOTHING
      RETURNING *
    `;

    if (created !== undefined) {
      return toStardanceReferralCode(created);
    }

    const raced = (await sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1
        FROM stardance_referral_codes
        WHERE user_id = ${userId}
          AND archived_at IS NULL
          AND LOWER(label) = LOWER(${label})
      ) AS exists
    `).at(0);

    if (raced?.exists === true) {
      throw new StardanceReferralCodeError("A referral code with that label already exists.", 409);
    }
  }

  throw new Error("Failed to create a Stardance referral code.");
}

type StardanceReferralRow = {
  id: string;
  user_id: string;
  referral_code_id: string;
  name: string;
  slack_id: string;
  email: string;
  hours_logged: string;
  hours_approved: string;
  verification_status: StardanceReferralVerificationStatus;
  referred_at: Date;
  referral_code_label: string;
  poster_id: string | null;
  poster_name: string | null;
};

export async function listStardanceReferralsForUser(
  userId: string,
  options: { query?: string | null } = {},
): Promise<StardanceReferral[]> {
  const query = options.query?.trim() ?? "";
  const pattern = query === "" ? null : `%${query.toLowerCase()}%`;
  await ensurePosterNameColumn();

  const rows = pattern === null
    ? await sql<StardanceReferralRow[]>`
        SELECT
          r.id,
          r.user_id,
          r.referral_code_id,
          r.name,
          r.slack_id,
          r.email,
          r.hours_logged::text AS hours_logged,
          r.hours_approved::text AS hours_approved,
          r.verification_status,
          r.referred_at,
          c.label AS referral_code_label,
          p.id AS poster_id,
          NULLIF(BTRIM(p.name), '') AS poster_name
        FROM stardance_referrals r
        JOIN stardance_referral_codes c ON c.id = r.referral_code_id
        LEFT JOIN posters p ON p.user_id = r.user_id AND LOWER(p.referral_code) = LOWER(c.code)
        WHERE r.user_id = ${userId}
        ORDER BY r.referred_at DESC, r.id ASC
      `
    : await sql<StardanceReferralRow[]>`
        SELECT
          r.id,
          r.user_id,
          r.referral_code_id,
          r.name,
          r.slack_id,
          r.email,
          r.hours_logged::text AS hours_logged,
          r.hours_approved::text AS hours_approved,
          r.verification_status,
          r.referred_at,
          c.label AS referral_code_label,
          p.id AS poster_id,
          NULLIF(BTRIM(p.name), '') AS poster_name
        FROM stardance_referrals r
        JOIN stardance_referral_codes c ON c.id = r.referral_code_id
        LEFT JOIN posters p ON p.user_id = r.user_id AND LOWER(p.referral_code) = LOWER(c.code)
        WHERE r.user_id = ${userId}
          AND (
            LOWER(c.label) LIKE ${pattern}
            OR LOWER(NULLIF(BTRIM(p.name), '')) LIKE ${pattern}
          )
        ORDER BY r.referred_at DESC, r.id ASC
      `;

  return rows
    .map((row) => ({
      id: row.id,
      kind: row.poster_id !== null ? "poster" as const : "signup" as const,
      name: row.name,
      slackId: row.slack_id,
      email: row.email,
      hoursLogged: Number.parseFloat(row.hours_logged),
      hoursApproved: Number.parseFloat(row.hours_approved),
      verificationStatus: row.verification_status,
      referredAt: row.referred_at.toISOString(),
      referralCodeId: row.referral_code_id,
      referralCodeLabel: row.referral_code_label,
      posterId: row.poster_id,
      posterName: row.poster_name,
    }))
    .sort((a, b) => {
      const diff = new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
}

export async function seedFakeStardanceReferralsForUser(userId: string) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  await sql`
    UPDATE stardance_referrals
    SET verification_status = 'unverified'
    WHERE user_id = ${userId} AND verification_status = 'rejected'
  `;

  const [existing] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM stardance_referrals
    WHERE user_id = ${userId}
  `;

  if (existing !== undefined && Number.parseInt(existing.count, 10) > 0) {
    return;
  }

  const codes = await sql<StardanceReferralCodeRow[]>`
    SELECT *
    FROM stardance_referral_codes
    WHERE user_id = ${userId} AND archived_at IS NULL
  `;

  if (codes.length === 0) {
    return;
  }

  const sampleNames = [
    "Aria Patel", "Ben Carter", "Cleo Nakamura", "Dani Ortiz", "Eli Becker",
    "Farah Idris", "Gus Lindqvist", "Hana Park", "Iris Vaughn", "Jules Tan",
    "Kai Mendez", "Lior Avraham", "Mira Singh", "Noor Hassan", "Omar Rivers",
    "Pia Conti", "Quinn Hayes", "Rafa Dovado", "Sana Karim", "Theo Walsh",
  ];
  const statuses: StardanceReferralVerificationStatus[] = [
    "unverified", "pending", "verified", "verified",
  ];

  const rowsToInsert = sampleNames.map((name, idx) => {
    const code = codes[idx % codes.length]!;
    const handle = name.toLowerCase().replace(/[^a-z]+/g, "");
    const hoursLogged = Math.round((idx * 1.7 + 3) * 10) / 10;
    const hoursApproved = Math.round(hoursLogged * 0.65 * 10) / 10;
    const daysAgo = idx * 3 + 1;
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      referral_code_id: code.id,
      name,
      slack_id: `U${handle.toUpperCase().slice(0, 8)}`,
      email: `${handle}@example.test`,
      hours_logged: hoursLogged,
      hours_approved: hoursApproved,
      verification_status: statuses[idx % statuses.length]!,
      referred_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  await sql`
    INSERT INTO stardance_referrals ${sql(rowsToInsert)}
  `;
}
