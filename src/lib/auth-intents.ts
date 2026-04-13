import { createHash } from "node:crypto";

import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";

export const AUTH_INTENT_COOKIE_NAME = "ambassador_auth_intent";

export type AuthEmailRetentionMetrics = {
  totalIntents: number;
  completedIntents: number;
  uniqueEmailsStarted: number;
  uniqueEmailsCompleted: number;
  uniqueEmailsCompletedWithin1Hour: number;
  uniqueEmailsCompletedAfter24Hours: number;
  uniqueEmailsReturnedAndCompleted: number;
  newUserCompletions: number;
  returningUserCompletions: number;
  averageMinutesToCompletion: number | null;
};

type RetentionMetricsRow = {
  total_intents: number;
  completed_intents: number;
  unique_emails_started: number;
  unique_emails_completed: number;
  unique_emails_completed_within_1_hour: number;
  unique_emails_completed_after_24_hours: number;
  unique_emails_returned_and_completed: number;
  new_user_completions: number;
  returning_user_completions: number;
  average_minutes_to_completion: number | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashEmail(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

export async function createAuthLoginIntent({
  email,
  source = "auth_page",
}: {
  email: string;
  source?: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) return null;

  await ensureSchema();

  const intentId = crypto.randomUUID();

  await sql`
    INSERT INTO auth_login_intents (
      id,
      email_hash,
      email_domain,
      source
    )
    VALUES (
      ${intentId},
      ${hashEmail(normalizedEmail)},
      ${normalizedEmail.split("@")[1] || null},
      ${source}
    )
  `;

  return {
    id: intentId,
    email: normalizedEmail,
  };
}

export async function markAuthLoginIntentCompleted({
  intentId,
  completedUserId,
  completedHcaId,
  completedEmail,
  wasExistingUser,
}: {
  intentId: string;
  completedUserId: string;
  completedHcaId: string;
  completedEmail: string | null;
  wasExistingUser: boolean;
}) {
  await ensureSchema();

  const normalizedCompletedEmail =
    completedEmail !== null && completedEmail !== "" ? normalizeEmail(completedEmail) : null;
  const completedEmailHash = normalizedCompletedEmail !== null ? hashEmail(normalizedCompletedEmail) : null;
  const completedEmailDomain = normalizedCompletedEmail !== null
    ? normalizedCompletedEmail.split("@")[1] ?? null
    : null;

  await sql`
    UPDATE auth_login_intents
    SET
      completed_at = COALESCE(completed_at, NOW()),
      completed_user_id = ${completedUserId},
      completed_hca_id = ${completedHcaId},
      completed_email_hash = ${completedEmailHash},
      completed_email_domain = ${completedEmailDomain},
      was_existing_user = ${wasExistingUser},
      updated_at = NOW()
    WHERE id = ${intentId}
  `;
}

export async function getAuthEmailRetentionMetrics({
  rangeDays,
}: {
  rangeDays?: number;
} = {}): Promise<AuthEmailRetentionMetrics> {
  await ensureSchema();

  const rows = await sql<RetentionMetricsRow[]>`
    WITH intents AS (
      SELECT *
      FROM auth_login_intents
      WHERE ${rangeDays ?? null}::int IS NULL
         OR started_at >= NOW() - make_interval(days => ${rangeDays ?? null}::int)
    ),
    per_email AS (
      SELECT
        email_hash,
        MIN(started_at) AS first_started_at,
        MIN(completed_at) FILTER (WHERE completed_at IS NOT NULL) AS first_completed_at
      FROM intents
      GROUP BY email_hash
    ),
    per_email_rollup AS (
      SELECT
        per_email.email_hash,
        per_email.first_started_at,
        per_email.first_completed_at,
        COUNT(intents.id)::int AS intent_count,
        COUNT(intents.id) FILTER (
          WHERE per_email.first_completed_at IS NOT NULL
            AND intents.started_at <= per_email.first_completed_at
        )::int AS intents_before_first_completion
      FROM per_email
      JOIN intents
        ON intents.email_hash = per_email.email_hash
      GROUP BY
        per_email.email_hash,
        per_email.first_started_at,
        per_email.first_completed_at
    ),
    completion_rollup AS (
      SELECT
        COUNT(*) FILTER (WHERE was_existing_user IS FALSE)::int AS new_user_completions,
        COUNT(*) FILTER (WHERE was_existing_user IS TRUE)::int AS returning_user_completions,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60.0)
          FILTER (WHERE completed_at IS NOT NULL) AS average_minutes_to_completion
      FROM intents
    )
    SELECT
      (SELECT COUNT(*)::int FROM intents) AS total_intents,
      (SELECT COUNT(*)::int FROM intents WHERE completed_at IS NOT NULL) AS completed_intents,
      (SELECT COUNT(DISTINCT email_hash)::int FROM intents) AS unique_emails_started,
      (
        SELECT COUNT(*)::int
        FROM per_email_rollup
        WHERE first_completed_at IS NOT NULL
      ) AS unique_emails_completed,
      (
        SELECT COUNT(*)::int
        FROM per_email_rollup
        WHERE first_completed_at IS NOT NULL
          AND first_completed_at <= first_started_at + INTERVAL '1 hour'
      ) AS unique_emails_completed_within_1_hour,
      (
        SELECT COUNT(*)::int
        FROM per_email_rollup
        WHERE first_completed_at IS NOT NULL
          AND first_completed_at > first_started_at + INTERVAL '24 hours'
      ) AS unique_emails_completed_after_24_hours,
      (
        SELECT COUNT(*)::int
        FROM per_email_rollup
        WHERE first_completed_at IS NOT NULL
          AND intents_before_first_completion > 1
      ) AS unique_emails_returned_and_completed,
      completion_rollup.new_user_completions,
      completion_rollup.returning_user_completions,
      ROUND(completion_rollup.average_minutes_to_completion)::int::float8 AS average_minutes_to_completion
    FROM completion_rollup
  `;
  const row = rows.at(0);

  return {
    totalIntents: row?.total_intents ?? 0,
    completedIntents: row?.completed_intents ?? 0,
    uniqueEmailsStarted: row?.unique_emails_started ?? 0,
    uniqueEmailsCompleted: row?.unique_emails_completed ?? 0,
    uniqueEmailsCompletedWithin1Hour: row?.unique_emails_completed_within_1_hour ?? 0,
    uniqueEmailsCompletedAfter24Hours: row?.unique_emails_completed_after_24_hours ?? 0,
    uniqueEmailsReturnedAndCompleted: row?.unique_emails_returned_and_completed ?? 0,
    newUserCompletions: row?.new_user_completions ?? 0,
    returningUserCompletions: row?.returning_user_completions ?? 0,
    averageMinutesToCompletion: row?.average_minutes_to_completion ?? null,
  };
}
