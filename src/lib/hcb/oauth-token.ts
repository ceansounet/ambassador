import "server-only";

import {
  AUTH_TOKEN_ENCRYPTION_CONTEXT,
  decryptToken,
  encryptToken,
  isEncryptedToken as isEncryptedStoredToken,
} from "@/lib/token-encryption";

export function encryptHcbOauthToken(token: string) {
  try {
    return encryptToken(token, AUTH_TOKEN_ENCRYPTION_CONTEXT);
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot encrypt an empty token") {
      throw new Error("Cannot encrypt an empty HCB OAuth token");
    }

    throw error;
  }
}

export function readHcbOauthToken(value: string | null | undefined) {
  const token = value?.trim();
  if (token === undefined || token === "") return null;

  if (!isEncryptedStoredToken(token)) {
    return token;
  }

  const plaintext = decryptToken(token, [
    AUTH_TOKEN_ENCRYPTION_CONTEXT,
    "ambassador:hcb-oauth-token",
  ]);

  if (plaintext === null) {
    console.error("Stored HCB OAuth token has an invalid encrypted format");
    return null;
  }

  return plaintext;
}
