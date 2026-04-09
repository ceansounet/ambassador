import { normalizeHackClubAddresses, type HackClubAddress } from "@/lib/settings";
import { requireEnv } from "@/lib/env";

const callbackUrl = `${requireEnv("CURRENT_DOMAIN")}/hca/oauth2/callback`;
export const OAUTH_STATE_COOKIE_NAME = "ambassador_oauth_state";
export const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 600;

export function getAuthorizationUrl(state: string, loginHint?: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("HCA_CLIENT_ID"),
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "email name profile address verification_status slack_id",
    state,
  });

  if (loginHint) {
    params.set("login_hint", loginHint);
  }

  return `${requireEnv("HCA_ISSUER")}/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const response = await fetch(`${requireEnv("HCA_ISSUER")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
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

export type HackClubUserInfo = {
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
};

export async function fetchUserInfo(accessToken: string) {
  const response = await fetch(`${requireEnv("HCA_ISSUER")}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`User info fetch failed: ${response.status}`);
  }

  return response.json() as Promise<HackClubUserInfo>;
}

export async function fetchHackClubAddresses(accessToken: string): Promise<HackClubAddress[]> {
  const userInfo = await fetchUserInfo(accessToken);
  return normalizeHackClubAddresses(userInfo.identity.addresses ?? []);
}
