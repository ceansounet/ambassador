import { cookies } from "next/headers";

import {
  AUTH_INTENT_COOKIE_NAME,
  createAuthLoginIntent,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth-intents";
import {
  getAuthorizationUrl,
  OAUTH_REDIRECT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const submittedEmail = url.searchParams.get("email");
  const normalizedSubmittedEmail =
    submittedEmail !== null && submittedEmail !== "" ? normalizeEmail(submittedEmail) : null;
  const nextPath = getSafeRedirectPath(url.searchParams.get("next"), "/dashboard");
  const state = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  });
  cookieStore.set(OAUTH_REDIRECT_COOKIE_NAME, nextPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
  });
  cookieStore.delete(AUTH_INTENT_COOKIE_NAME);

  let loginHint: string | undefined;

  if (normalizedSubmittedEmail !== null) {
    try {
      const intent = await createAuthLoginIntent({
        email: normalizedSubmittedEmail,
      });

      if (intent) {
        loginHint = intent.email;
        cookieStore.set(AUTH_INTENT_COOKIE_NAME, intent.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      } else if (isValidEmail(normalizedSubmittedEmail)) {
        loginHint = normalizedSubmittedEmail;
      }
    } catch (error) {
      console.error("Failed to create auth login intent", { error });
      if (isValidEmail(normalizedSubmittedEmail)) {
        loginHint = normalizedSubmittedEmail;
      }
    }
  }

  return Response.redirect(getAuthorizationUrl(state, loginHint));
}
