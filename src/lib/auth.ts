import { normalizeHackClubAddresses, type HackClubAddress } from "@/lib/settings";
import { requireEnv } from "@/lib/env";

const callbackUrl = `${requireEnv("CURRENT_DOMAIN")}/hca/oauth2/callback`;
export const OAUTH_STATE_COOKIE_NAME = "ambassador_oauth_state";
export const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 600;
export const OAUTH_REDIRECT_COOKIE_NAME = "ambassador_oauth_next";

export function getAuthorizationUrl(state: string, loginHint?: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("HCA_CLIENT_ID"),
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "email name profile address verification_status slack_id",
    state,
  });

  if (loginHint !== undefined && loginHint !== "") {
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

  const data = await response.json();
  const payload: Record<string, unknown> | null =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? Object.fromEntries(Object.entries(data))
      : null;

  if (payload === null || typeof payload.access_token !== "string" || typeof payload.token_type !== "string") {
    throw new Error("Token exchange returned an invalid response");
  }

  return {
    access_token: payload.access_token,
    token_type: payload.token_type,
  };
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

  const data = await response.json();
  const payload: Record<string, unknown> | null =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? Object.fromEntries(Object.entries(data))
      : null;
  const identitySource =
    typeof payload?.identity === "object" && payload.identity !== null && !Array.isArray(payload.identity)
      ? Object.fromEntries(Object.entries(payload.identity))
      : null;
  const scopes = Array.isArray(payload?.scopes)
    ? payload.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  if (identitySource === null || typeof identitySource.id !== "string") {
    throw new Error("User info fetch returned an invalid response");
  }

  return {
    identity: {
      id: identitySource.id,
      first_name: typeof identitySource.first_name === "string" ? identitySource.first_name : undefined,
      last_name: typeof identitySource.last_name === "string" ? identitySource.last_name : undefined,
      primary_email: typeof identitySource.primary_email === "string" ? identitySource.primary_email : undefined,
      slack_id: typeof identitySource.slack_id === "string" ? identitySource.slack_id : undefined,
      slack_name: typeof identitySource.slack_name === "string" ? identitySource.slack_name : undefined,
      slack_username: typeof identitySource.slack_username === "string" ? identitySource.slack_username : undefined,
      slack_display_name: typeof identitySource.slack_display_name === "string" ? identitySource.slack_display_name : undefined,
      slack_avatar_url: typeof identitySource.slack_avatar_url === "string" ? identitySource.slack_avatar_url : undefined,
      slack_avatar: typeof identitySource.slack_avatar === "string" ? identitySource.slack_avatar : undefined,
      avatar: typeof identitySource.avatar === "string" ? identitySource.avatar : undefined,
      photo: typeof identitySource.photo === "string" ? identitySource.photo : undefined,
      verification_status: typeof identitySource.verification_status === "string" ? identitySource.verification_status : undefined,
      addresses: Array.isArray(identitySource.addresses)
        ? identitySource.addresses
            .filter((address) => typeof address === "object" && address !== null && !Array.isArray(address))
            .map((address) => {
              const record = Object.fromEntries(Object.entries(address));
              return {
                id: typeof record.id === "string" ? record.id : undefined,
                first_name: typeof record.first_name === "string" ? record.first_name : undefined,
                last_name: typeof record.last_name === "string" ? record.last_name : undefined,
                line_1: typeof record.line_1 === "string" ? record.line_1 : undefined,
                line_2: typeof record.line_2 === "string" ? record.line_2 : undefined,
                city: typeof record.city === "string" ? record.city : undefined,
                state: typeof record.state === "string" ? record.state : undefined,
                postal_code: typeof record.postal_code === "string" ? record.postal_code : undefined,
                country: typeof record.country === "string" ? record.country : undefined,
                phone_number: typeof record.phone_number === "string" ? record.phone_number : undefined,
                primary: typeof record.primary === "boolean" ? record.primary : undefined,
              };
            })
        : undefined,
    },
    scopes,
  };
}

export async function fetchHackClubAddresses(accessToken: string): Promise<HackClubAddress[]> {
  const userInfo = await fetchUserInfo(accessToken);
  return normalizeHackClubAddresses(userInfo.identity.addresses ?? []);
}
