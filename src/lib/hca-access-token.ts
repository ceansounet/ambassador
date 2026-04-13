import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { requireEnv } from "@/lib/env";

const ENCRYPTED_PREFIX = "enc:v1";
const ENCRYPTION_CONTEXT = "ambassador:hca-access-token";

function getEncryptionKey() {
  return createHash("sha256")
    .update(`${ENCRYPTION_CONTEXT}:${requireEnv("JWT_SECRET")}`)
    .digest();
}

export function isEncryptedHcaAccessToken(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${ENCRYPTED_PREFIX}:`));
}

export function encryptHcaAccessToken(token: string) {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new Error("Cannot encrypt an empty HCA access token");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(trimmedToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function readHcaAccessToken(value: string | null | undefined) {
  const token = value?.trim();
  if (!token) return null;

  if (!isEncryptedHcaAccessToken(token)) {
    return token;
  }

  const [, ivValue, authTagValue, ciphertextValue] = token.split(":");
  if (!ivValue || !authTagValue || !ciphertextValue) {
    console.error("Stored HCA access token has an invalid encrypted format");
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return plaintext || null;
  } catch (error) {
    console.error("Failed to decrypt stored HCA access token", { error });
    return null;
  }
}
