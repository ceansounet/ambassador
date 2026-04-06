import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { isProduction, requireEnv } from "@/lib/env";

const COOKIE_NAME = "ambassador_token";
const SECRET = new TextEncoder().encode(requireEnv("JWT_SECRET"));

export type TokenPayload = {
  sub: string;
  email?: string;
  displayName: string;
  slackId?: string;
  isAdmin: boolean;
};

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function setSession(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 2592000,
  });
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  return verifyToken(cookie.value);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
