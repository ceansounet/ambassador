import { cookies } from "next/headers";

import {
  getAuthorizationUrl,
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth";

export async function GET() {
  const state = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  });

  return Response.redirect(getAuthorizationUrl(state));
}
