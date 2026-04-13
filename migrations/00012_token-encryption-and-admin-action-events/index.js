const ENCRYPTED_PREFIX = "enc:v1";
const ENCRYPTION_CONTEXT = "ambassador:hca-access-token";
const GCM_AUTH_TAG_LENGTH = 16;

function requireEnv(name) {
  const value = process.env[name] && process.env[name].trim();

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function getEncryptionKey(createHash) {
  return createHash("sha256")
    .update(`${ENCRYPTION_CONTEXT}:${requireEnv("JWT_SECRET")}`)
    .digest();
}

function encryptToken(token, key, { createCipheriv, randomBytes }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

module.exports = async function migrate(sql) {
  const { createCipheriv, createHash, randomBytes } = await import("node:crypto");

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_access_token_encrypted_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_action_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS admin_action_events_actor_created_at_idx
    ON admin_action_events (actor_user_id, created_at DESC, id DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS admin_action_events_target_created_at_idx
    ON admin_action_events (target_user_id, created_at DESC, id DESC)
  `;

  const users = await sql`
    SELECT id, hca_access_token
    FROM users
    WHERE hca_access_token IS NOT NULL
      AND hca_access_token_encrypted_at IS NULL
  `;

  if (users.length === 0) {
    return;
  }

  const encryptionKey = getEncryptionKey(createHash);

  for (const user of users) {
    const token =
      typeof user.hca_access_token === "string"
        ? user.hca_access_token.trim()
        : "";

    if (!token) {
      await sql`
        UPDATE users
        SET hca_access_token = NULL,
            hca_access_token_encrypted_at = NULL,
            updated_at = NOW()
        WHERE id = ${user.id}
      `;
      continue;
    }

    const encryptedToken = token.startsWith(`${ENCRYPTED_PREFIX}:`)
      ? token
      : encryptToken(token, encryptionKey, { createCipheriv, randomBytes });

    await sql`
      UPDATE users
      SET hca_access_token = ${encryptedToken},
          hca_access_token_encrypted_at = COALESCE(hca_access_token_encrypted_at, NOW()),
          updated_at = NOW()
      WHERE id = ${user.id}
    `;
  }
};
