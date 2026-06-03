import sql from "@/lib/database/client";

export type HackatimeTrustRecord = {
  slackId: string;
  trustLevel: string;
  fetchedAt: string;
};

type HackatimeTrustRow = {
  slack_id: string;
  trust_level: string;
  fetched_at: Date | string;
};

class HackatimeTrustFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HackatimeTrustFetchError";
  }
}

function normalizeSlackId(slackId: string | null | undefined) {
  const trimmedSlackId = slackId?.trim() ?? "";

  return trimmedSlackId === "" ? null : trimmedSlackId;
}

function toTrustRecord(row: HackatimeTrustRow): HackatimeTrustRecord {
  return {
    slackId: row.slack_id,
    trustLevel: row.trust_level,
    fetchedAt: row.fetched_at instanceof Date
      ? row.fetched_at.toISOString()
      : row.fetched_at,
  };
}

function readTrustLevel(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const trustFactor = Reflect.get(payload, "trust_factor");
  if (typeof trustFactor !== "object" || trustFactor === null) {
    return null;
  }

  const trustLevel = Reflect.get(trustFactor, "trust_level");
  return typeof trustLevel === "string" && trustLevel.trim() !== ""
    ? trustLevel.trim()
    : null;
}

export async function getCachedHackatimeTrustLevel(slackId: string | null | undefined) {
  const normalizedSlackId = normalizeSlackId(slackId);

  if (normalizedSlackId === null) {
    return null;
  }

  const row = (await sql<HackatimeTrustRow[]>`
    SELECT slack_id, trust_level, fetched_at
    FROM hackatime_trust_levels
    WHERE slack_id = ${normalizedSlackId}
    LIMIT 1
  `).at(0);

  return row === undefined ? null : toTrustRecord(row);
}

export async function refreshHackatimeTrustLevel(slackId: string | null | undefined) {
  const normalizedSlackId = normalizeSlackId(slackId);

  if (normalizedSlackId === null) {
    throw new HackatimeTrustFetchError("Slack ID is required.");
  }

  const response = await fetch(
    `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(normalizedSlackId)}/stats`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new HackatimeTrustFetchError(`Hackatime request failed with status ${response.status}.`);
  }

  const trustLevel = readTrustLevel(await response.json() as unknown);

  if (trustLevel === null) {
    throw new HackatimeTrustFetchError("Hackatime response did not include a trust level.");
  }

  const row = (await sql<HackatimeTrustRow[]>`
    INSERT INTO hackatime_trust_levels (slack_id, trust_level, fetched_at)
    VALUES (${normalizedSlackId}, ${trustLevel}, NOW())
    ON CONFLICT (slack_id) DO UPDATE
      SET trust_level = EXCLUDED.trust_level,
          fetched_at = EXCLUDED.fetched_at
    RETURNING slack_id, trust_level, fetched_at
  `).at(0);

  if (row === undefined) {
    throw new HackatimeTrustFetchError("Hackatime trust level could not be cached.");
  }

  return toTrustRecord(row);
}
