import "server-only";

import sql from "@/lib/database/client";
import { requireEnv } from "@/lib/env";
import {
  encryptHcbOauthToken,
  readHcbOauthToken,
} from "@/lib/hcb/oauth-token";

type HcbOauthCredentialsRow = {
  id: string;
  authorized_hcb_user_id: string | null;
  authorized_hcb_user_name: string | null;
  authorized_hcb_user_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  scopes: string | null;
  expires_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
  authorized_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type HcbCurrentUserResponse = {
  id: string;
  name: string;
  email: string | null;
};

type HcbTokenResponse = {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string | null;
  expires_in: number | null;
};

export type HcbOauthConnection = {
  id: string;
  authorizedHcbUserId: string | null;
  authorizedHcbUserName: string | null;
  authorizedHcbUserEmail: string | null;
  scopes: string | null;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  lastError: string | null;
  authorizedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HcbCardGrant = {
  id: string;
  amountCents: number;
  purpose: string | null;
  email: string | null;
  status: string | null;
  balanceCents: number | null;
  organizationId: string | null;
  organizationName: string | null;
};

export class HcbApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HcbApiError";
    this.status = status;
    this.body = body;
  }
}

function getHcbRedirectUrl() {
  return `${requireEnv("CURRENT_DOMAIN")}/hcb/sensitive/redirect`;
}

function getHcbClientId() {
  return requireEnv("HCB_UID");
}

function getHcbClientSecret() {
  return requireEnv("HCB_SECRET");
}

function toIsoOrNull(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(Date.now() + value * 1000).toISOString();
}

function parseJsonRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTokenResponse(payload: unknown): HcbTokenResponse {
  const record = parseJsonRecord(payload);

  if (
    record === null ||
    typeof record.access_token !== "string" ||
    typeof record.token_type !== "string"
  ) {
    throw new Error("HCB token exchange returned an invalid response");
  }

  return {
    access_token: record.access_token,
    refresh_token: toStringOrNull(record.refresh_token),
    token_type: record.token_type,
    scope: toStringOrNull(record.scope),
    expires_in: toNumberOrNull(record.expires_in),
  };
}

function normalizeCurrentUser(payload: unknown): HcbCurrentUserResponse {
  const record = parseJsonRecord(payload);

  if (record === null || typeof record.id !== "string" || typeof record.name !== "string") {
    throw new Error("HCB current-user response was invalid");
  }

  return {
    id: record.id,
    name: record.name,
    email: toStringOrNull(record.email),
  };
}

function normalizeCardGrant(payload: unknown): HcbCardGrant {
  const record = parseJsonRecord(payload);
  const organization = parseJsonRecord(record?.organization);

  if (record === null || typeof record.id !== "string" || typeof record.amount_cents !== "number") {
    throw new Error("HCB card grant response was invalid");
  }

  return {
    id: record.id,
    amountCents: record.amount_cents,
    purpose: toStringOrNull(record.purpose),
    email: toStringOrNull(record.email),
    status: toStringOrNull(record.status),
    balanceCents: toNumberOrNull(record.balance_cents),
    organizationId: organization !== null && typeof organization.id === "string"
      ? organization.id
      : null,
    organizationName: organization !== null ? toStringOrNull(organization.name) : null,
  };
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getRefreshBufferMs() {
  return 60_000;
}

function isExpiringSoon(expiresAt: string | null) {
  if (expiresAt === null || expiresAt === "") return true;

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) return true;

  return expiresAtMs <= Date.now() + getRefreshBufferMs();
}

async function loadCredentialsRow() {
  return (await sql<HcbOauthCredentialsRow[]>`
    SELECT id, authorized_hcb_user_id, authorized_hcb_user_name, authorized_hcb_user_email,
           access_token, refresh_token, token_type, scopes, expires_at, last_refreshed_at,
           last_error, authorized_by_user_id, created_at, updated_at
    FROM hcb_oauth_credentials
    WHERE id = ${"primary"}
    LIMIT 1
  `).at(0) ?? null;
}

async function updateLastError(message: string) {
  await sql`
    UPDATE hcb_oauth_credentials
    SET last_error = ${message},
        updated_at = NOW()
    WHERE id = ${"primary"}
  `;
}

async function persistTokenResponse(input: {
  tokens: HcbTokenResponse;
  authorizedHcbUserId?: string | null;
  authorizedHcbUserName?: string | null;
  authorizedHcbUserEmail?: string | null;
  authorizedByUserId?: string | null;
}) {
  await sql`
    INSERT INTO hcb_oauth_credentials (
      id,
      authorized_hcb_user_id,
      authorized_hcb_user_name,
      authorized_hcb_user_email,
      access_token,
      refresh_token,
      token_type,
      scopes,
      expires_at,
      last_refreshed_at,
      last_error,
      authorized_by_user_id,
      created_at,
      updated_at
    )
    VALUES (
      ${"primary"},
      ${input.authorizedHcbUserId ?? null},
      ${input.authorizedHcbUserName ?? null},
      ${input.authorizedHcbUserEmail ?? null},
      ${encryptHcbOauthToken(input.tokens.access_token)},
      ${input.tokens.refresh_token === null ? null : encryptHcbOauthToken(input.tokens.refresh_token)},
      ${input.tokens.token_type},
      ${input.tokens.scope},
      ${toIsoOrNull(input.tokens.expires_in)},
      ${new Date()},
      NULL,
      ${input.authorizedByUserId ?? null},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      authorized_hcb_user_id = COALESCE(EXCLUDED.authorized_hcb_user_id, hcb_oauth_credentials.authorized_hcb_user_id),
      authorized_hcb_user_name = COALESCE(EXCLUDED.authorized_hcb_user_name, hcb_oauth_credentials.authorized_hcb_user_name),
      authorized_hcb_user_email = COALESCE(EXCLUDED.authorized_hcb_user_email, hcb_oauth_credentials.authorized_hcb_user_email),
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, hcb_oauth_credentials.refresh_token),
      token_type = EXCLUDED.token_type,
      scopes = EXCLUDED.scopes,
      expires_at = EXCLUDED.expires_at,
      last_refreshed_at = EXCLUDED.last_refreshed_at,
      last_error = NULL,
      authorized_by_user_id = COALESCE(EXCLUDED.authorized_by_user_id, hcb_oauth_credentials.authorized_by_user_id),
      updated_at = NOW()
  `;
}

async function exchangeToken(params: URLSearchParams) {
  const response = await fetch(`${"https://hcb.hackclub.com"}/api/v4/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new HcbApiError(
      `HCB token exchange failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  return normalizeTokenResponse(body);
}

async function refreshAccessToken(row: HcbOauthCredentialsRow) {
  const refreshToken = readHcbOauthToken(row.refresh_token);
  if (refreshToken === null) {
    throw new Error("Stored HCB refresh token is missing");
  }

  const tokens = await exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getHcbClientId(),
      client_secret: getHcbClientSecret(),
    }),
  );

  await persistTokenResponse({
    tokens,
    authorizedHcbUserId: row.authorized_hcb_user_id,
    authorizedHcbUserName: row.authorized_hcb_user_name,
    authorizedHcbUserEmail: row.authorized_hcb_user_email,
    authorizedByUserId: row.authorized_by_user_id,
  });

  return tokens.access_token;
}

async function getAccessToken(options?: { forceRefresh?: boolean }) {
  const row = await loadCredentialsRow();
  if (row === null) {
    return null;
  }

  const storedAccessToken = readHcbOauthToken(row.access_token);

  if (options?.forceRefresh !== true && storedAccessToken !== null && !isExpiringSoon(row.expires_at)) {
    return storedAccessToken;
  }

  try {
    return await refreshAccessToken(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateLastError(message);

    if (options?.forceRefresh !== true && storedAccessToken !== null) {
      return storedAccessToken;
    }

    throw error;
  }
}

async function requestHcbJson(
  path: string,
  init?: RequestInit,
  options?: { forceRefresh?: boolean },
) {
  const accessToken = await getAccessToken({ forceRefresh: options?.forceRefresh });
  if (accessToken === null) {
    throw new Error("HCB is not authorized");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  const response = await fetch(`${"https://hcb.hackclub.com"}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = await readResponseBody(response);

  if (response.status === 401 && options?.forceRefresh !== true) {
    return requestHcbJson(path, init, { forceRefresh: true });
  }

  if (!response.ok) {
    throw new HcbApiError(
      `HCB API request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  return body;
}

export function getHcbAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: getHcbClientId(),
    redirect_uri: getHcbRedirectUrl(),
    response_type: "code",
    scope: "read write",
    state,
  });

  return `${"https://hcb.hackclub.com"}/api/v4/oauth/authorize?${params}`;
}

async function exchangeHcbCodeForTokens(code: string) {
  return exchangeToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: getHcbClientId(),
      client_secret: getHcbClientSecret(),
      redirect_uri: getHcbRedirectUrl(),
    }),
  );
}

async function fetchHcbCurrentUser(accessToken: string) {
  const response = await fetch(`${"https://hcb.hackclub.com"}/api/v4/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new HcbApiError(
      `HCB current-user request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  return normalizeCurrentUser(body);
}

export async function saveHcbAuthorization(input: {
  code: string;
  authorizedByUserId: string | null;
}) {
  const tokens = await exchangeHcbCodeForTokens(input.code);
  const currentUser = await fetchHcbCurrentUser(tokens.access_token);

  await persistTokenResponse({
    tokens,
    authorizedHcbUserId: currentUser.id,
    authorizedHcbUserName: currentUser.name,
    authorizedHcbUserEmail: currentUser.email,
    authorizedByUserId: input.authorizedByUserId,
  });

  return {
    currentUser,
    scopes: tokens.scope,
    expiresAt: toIsoOrNull(tokens.expires_in),
  };
}

export async function getHcbOauthConnection() {
  const row = await loadCredentialsRow();
  if (row === null) return null;

  return {
    id: row.id,
    authorizedHcbUserId: row.authorized_hcb_user_id,
    authorizedHcbUserName: row.authorized_hcb_user_name,
    authorizedHcbUserEmail: row.authorized_hcb_user_email,
    scopes: row.scopes,
    expiresAt: row.expires_at,
    lastRefreshedAt: row.last_refreshed_at,
    lastError: row.last_error,
    authorizedByUserId: row.authorized_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies HcbOauthConnection;
}

export async function fetchHcbCardGrant(grantId: string) {
  const body = await requestHcbJson(
    `/api/v4/card_grants/${encodeURIComponent(grantId)}?expand=organization,balance_cents`,
  );

  return normalizeCardGrant(body);
}

export async function listHcbOrganizationCardGrants(organizationId: string) {
  const body = await requestHcbJson(
    `/api/v4/organizations/${encodeURIComponent(organizationId)}/card_grants`,
  );

  if (!Array.isArray(body)) {
    throw new Error("HCB organization card-grants response was invalid");
  }

  return body.map((entry) => normalizeCardGrant(entry));
}

export async function createHcbOrganizationCardGrant(input: {
  organizationId: string;
  email: string;
  amountCents: number;
  purpose: string;
  instructions?: string | null;
  idempotencyKey?: string | null;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof input.idempotencyKey === "string" && input.idempotencyKey !== "") {
    headers["Idempotency-Key"] = input.idempotencyKey;
  }

  const body = await requestHcbJson(
    `/api/v4/organizations/${encodeURIComponent(input.organizationId)}/card_grants`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: input.email,
        amount_cents: input.amountCents,
        purpose: input.purpose,
        instructions: input.instructions ?? undefined,
      }),
    },
  );

  return normalizeCardGrant(body);
}
