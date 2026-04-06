import { requireEnv } from "@/lib/env";

const callbackUrl = `${requireEnv("CURRENT_DOMAIN")}/hca/oauth2/callback`;
export const OAUTH_STATE_COOKIE_NAME = "ambassador_oauth_state";
export const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 600;

export function getAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("HCA_CLIENT_ID"),
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "email name profile address verification_status slack_id",
    state,
  });

  return `${requireEnv("HCA_ISSUER")}/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const response = await fetch(`${requireEnv("HCA_ISSUER")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: requireEnv("HCA_CLIENT_ID"),
      client_secret: requireEnv("HCA_CLIENT_SECRET"),
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
  }>;
}

export async function fetchUserInfo(accessToken: string) {
  const response = await fetch(`${requireEnv("HCA_ISSUER")}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`User info fetch failed: ${response.status}`);
  }

  return response.json() as Promise<{
    identity: {
      id: string;
      first_name?: string;
      last_name?: string;
      primary_email?: string;
      slack_id?: string;
      slack_name?: string;
      slack_username?: string;
      slack_display_name?: string;
      slack_avatar_url?: string;
      slack_avatar?: string;
      avatar?: string;
      photo?: string;
      verification_status?: string;
      addresses?: Array<{
        id?: string;
        first_name?: string;
        last_name?: string;
        line_1?: string;
        line_2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
        phone_number?: string;
        primary?: boolean;
      }>;
    };
    scopes: string[];
  }>;
}
