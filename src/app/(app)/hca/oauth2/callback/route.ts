import { cookies } from "next/headers";

import { linkApplicationsToUser } from "@/lib/applications/sync";
import {
  AUTH_INTENT_COOKIE_NAME,
  markAuthLoginIntentCompleted,
} from "@/lib/auth-intents";
import {
  exchangeCodeForToken,
  OAUTH_REDIRECT_COOKIE_NAME,
  fetchUserInfo,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { fetchGeo, geocodeIp, linkAnonymousVisits } from "@/lib/geo";
import { encryptHcaAccessToken } from "@/lib/hca-access-token";
import { getRequestIp, getSafeRedirectPath } from "@/lib/http";
import { createToken, setSession } from "@/lib/session";
import {
  normalizeHackClubAddresses,
  resolveAmbassadorRegion,
  resolveDetectedAmbassadorRegion,
} from "@/lib/settings";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const nextPath = getSafeRedirectPath(
    cookieStore.get(OAUTH_REDIRECT_COOKIE_NAME)?.value,
    "/dashboard",
  );
  const authIntentId = cookieStore.get(AUTH_INTENT_COOKIE_NAME)?.value;

  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);
  cookieStore.delete(OAUTH_REDIRECT_COOKIE_NAME);

  if (!state || !expectedState || state !== expectedState) {
    cookieStore.delete(AUTH_INTENT_COOKIE_NAME);
    return Response.redirect(`${process.env.CURRENT_DOMAIN}/?error=invalid_state`);
  }

  if (!code) {
    cookieStore.delete(AUTH_INTENT_COOKIE_NAME);
    return Response.redirect(`${process.env.CURRENT_DOMAIN}/?error=no_code`);
  }

  const tokenData = await exchangeCodeForToken(code);
  const userInfo = await fetchUserInfo(tokenData.access_token);

  const displayName =
    [userInfo.identity.first_name, userInfo.identity.last_name]
      .filter(Boolean)
      .join(" ") || "Hacker";

  const hcaId = userInfo.identity.id;
  const email = userInfo.identity.primary_email;
  const slackId = userInfo.identity.slack_id;
  const slackName =
    userInfo.identity.slack_name ??
    userInfo.identity.slack_display_name ??
    userInfo.identity.slack_username ??
    null;
  const slackAvatarUrl =
    userInfo.identity.slack_avatar_url ??
    userInfo.identity.slack_avatar ??
    userInfo.identity.avatar ??
    userInfo.identity.photo ??
    null;
  const verificationStatus = userInfo.identity.verification_status;
  const allAddresses = normalizeHackClubAddresses(userInfo.identity.addresses ?? []);
  const primaryAddress = allAddresses[0] ?? null;
  const encryptedAccessToken = encryptHcaAccessToken(tokenData.access_token);

  const ip = getRequestIp(request);
  const addressCountry = primaryAddress?.country?.trim() || null;
  const signupGeo = addressCountry ? null : await fetchGeo(ip);

  await ensureSchema();

  const [existingUser] = await sql<{ id: string; ambassador_region: string | null }[]>`
    SELECT id, ambassador_region
    FROM users
    WHERE hca_id = ${hcaId}
    LIMIT 1
  `;
  const wasExistingUser = Boolean(existingUser);
  const detectedAmbassadorRegion =
    resolveDetectedAmbassadorRegion(
      addressCountry,
      signupGeo?.country_code,
      signupGeo?.country_name,
    ) ?? "United States";
  const ambassadorRegion = resolveAmbassadorRegion(
    existingUser?.ambassador_region ?? null,
    detectedAmbassadorRegion,
  );
  const id = crypto.randomUUID();

  const [user] = await sql`
    INSERT INTO users (
      id, hca_id, email, display_name, hca_first_name, hca_last_name,
      hca_street_address, hca_locality, hca_region, hca_postal_code, hca_country,
      slack_id, slack_name, slack_avatar_url, verification_status, last_ip,
      latitude, longitude, city, region, country_code, country_name, postal_code,
      timezone, org, geocoded_at, hca_addresses, ambassador_region, hca_access_token,
      hca_access_token_encrypted_at
    )
    VALUES (
      ${id},
      ${hcaId},
      ${email ?? null},
      ${displayName},
      ${userInfo.identity.first_name ?? null},
      ${userInfo.identity.last_name ?? null},
      ${primaryAddress?.line_1 ?? null},
      ${primaryAddress?.city ?? null},
      ${primaryAddress?.state ?? null},
      ${primaryAddress?.postal_code ?? null},
      ${primaryAddress?.country ?? null},
      ${slackId ?? null},
      ${slackName},
      ${slackAvatarUrl},
      ${verificationStatus ?? null},
      ${ip},
      ${signupGeo?.latitude ?? null},
      ${signupGeo?.longitude ?? null},
      ${signupGeo?.city ?? null},
      ${signupGeo?.region ?? null},
      ${signupGeo?.country_code ?? null},
      ${addressCountry ?? signupGeo?.country_name ?? null},
      ${signupGeo?.postal_code ?? null},
      ${signupGeo?.timezone ?? null},
      ${signupGeo?.org ?? null},
      ${signupGeo ? new Date() : null},
      ${JSON.stringify(allAddresses)},
      ${ambassadorRegion},
      ${encryptedAccessToken},
      ${new Date()}
    )
    ON CONFLICT (hca_id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      hca_first_name = EXCLUDED.hca_first_name,
      hca_last_name = EXCLUDED.hca_last_name,
      hca_street_address = EXCLUDED.hca_street_address,
      hca_locality = EXCLUDED.hca_locality,
      hca_region = EXCLUDED.hca_region,
      hca_postal_code = EXCLUDED.hca_postal_code,
      hca_country = EXCLUDED.hca_country,
      slack_id = EXCLUDED.slack_id,
      slack_name = EXCLUDED.slack_name,
      slack_avatar_url = EXCLUDED.slack_avatar_url,
      verification_status = EXCLUDED.verification_status,
      last_ip = EXCLUDED.last_ip,
      latitude = COALESCE(EXCLUDED.latitude, users.latitude),
      longitude = COALESCE(EXCLUDED.longitude, users.longitude),
      city = COALESCE(EXCLUDED.city, users.city),
      region = COALESCE(EXCLUDED.region, users.region),
      country_code = COALESCE(EXCLUDED.country_code, users.country_code),
      country_name = COALESCE(EXCLUDED.country_name, users.country_name),
      postal_code = COALESCE(EXCLUDED.postal_code, users.postal_code),
      timezone = COALESCE(EXCLUDED.timezone, users.timezone),
      org = COALESCE(EXCLUDED.org, users.org),
      geocoded_at = COALESCE(EXCLUDED.geocoded_at, users.geocoded_at),
      hca_addresses = EXCLUDED.hca_addresses,
      ambassador_region = CASE
        WHEN users.ambassador_region = 'Other' AND EXCLUDED.ambassador_region <> 'Other'
          THEN EXCLUDED.ambassador_region
        WHEN users.ambassador_region IS NULL
          THEN EXCLUDED.ambassador_region
        ELSE users.ambassador_region
      END,
      hca_access_token = EXCLUDED.hca_access_token,
      hca_access_token_encrypted_at = NOW(),
      updated_at = NOW()
    RETURNING id, is_admin
  `;

  if (authIntentId) {
    try {
      await markAuthLoginIntentCompleted({
        intentId: authIntentId,
        completedUserId: user.id,
        completedHcaId: hcaId,
        completedEmail: email ?? null,
        wasExistingUser,
      });
    } catch (error) {
      console.error("Failed to mark auth login intent complete", {
        authIntentId,
        error,
      });
    }
    cookieStore.delete(AUTH_INTENT_COOKIE_NAME);
  }

  await sql`
    INSERT INTO ip_visits (
      id, ip, user_id, visit_type, latitude, longitude, city, region,
      country_code, country_name, postal_code, timezone, org, geocoded_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${ip},
      ${user.id},
      'signup',
      ${signupGeo?.latitude ?? null},
      ${signupGeo?.longitude ?? null},
      ${signupGeo?.city ?? null},
      ${signupGeo?.region ?? null},
      ${signupGeo?.country_code ?? null},
      ${signupGeo?.country_name ?? null},
      ${signupGeo?.postal_code ?? null},
      ${signupGeo?.timezone ?? null},
      ${signupGeo?.org ?? null},
      ${signupGeo ? new Date() : null}
    )
  `;

  if (!signupGeo) {
    void geocodeIp(ip, "users", user.id).catch((error) => {
      console.error("Failed to geocode signed-in user", { userId: user.id, error });
    });
    void geocodeIp(ip, "ip_visits", null, user.id, "signup").catch((error) => {
      console.error("Failed to geocode signup visit", { userId: user.id, error });
    });
  }
  void linkAnonymousVisits(ip, user.id).catch((error) => {
    console.error("Failed to link anonymous visits", { userId: user.id, error });
  });
  void linkApplicationsToUser({
    userId: user.id,
    email: email ?? null,
    hcaId,
    slackId: slackId ?? null,
  }).catch((error) => {
    console.error("Failed to link applications to user", { userId: user.id, error });
  });

  const token = await createToken({
    sub: user.id,
    email: email ?? undefined,
    displayName,
    slackId: slackId ?? undefined,
    isAdmin: user.is_admin,
  });

  await setSession(token);

  return Response.redirect(`${process.env.CURRENT_DOMAIN}${nextPath}`);
}
