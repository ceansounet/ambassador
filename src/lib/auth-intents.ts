import { createHash } from "node:crypto";

import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";

export const AUTH_INTENT_COOKIE_NAME = "ambassador_auth_intent";

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
