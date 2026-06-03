import "server-only";

import {
  AUTH_TOKEN_ENCRYPTION_CONTEXT,
  decryptToken,
  encryptToken,
  isEncryptedToken,
} from "@/lib/token-encryption";

function isEncryptedHcaAccessToken(value: string | null | undefined) {
  return isEncryptedToken(value);
}

export function encryptHcaAccessToken(token: string) {
  try {
    return encryptToken(token, AUTH_TOKEN_ENCRYPTION_CONTEXT);
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot encrypt an empty token") {
      throw new Error("Cannot encrypt an empty HCA access token");
    }

    throw error;
  }
}

export function readHcaAccessToken(value: string | null | undefined) {
  const token = value?.trim();
  if (token === undefined || token === "") return null;

  if (!isEncryptedHcaAccessToken(token)) {
    console.error("Stored HCA access token is not encrypted");
    return null;
  }

  const plaintext = decryptToken(token, AUTH_TOKEN_ENCRYPTION_CONTEXT);

  if (plaintext === null) {
    console.error("Stored HCA access token has an invalid encrypted format");
    return null;
  }

  return plaintext;
}
