import { cookies } from "next/headers";

import { linkApplicationsToUser } from "@/lib/application-sync";
import {
  exchangeCodeForToken,
  fetchUserInfo,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/auth";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { geocodeIp, linkAnonymousVisits } from "@/lib/geo";
import { getRequestIp } from "@/lib/http";
import { createToken, setSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/user-address-schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);

  if (!state || !expectedState || state !== expectedState) {
    return Response.redirect(`${process.env.CURRENT_DOMAIN}/?error=invalid_state`);
  }

  if (!code) {
    return Response.redirect(`${process.env.CURRENT_DOMAIN}/?error=no_code`);
  }

  const tokenData = await exchangeCodeForToken(code);
  const userInfo = await fetchUserInfo(tokenData.access_token);

  const displayName =
    [userInfo.identity.first_name, userInfo.identity.last_name]
      .filter(Boolean)
      .join(" ") || "Hacker";
  const allAddresses = userInfo.identity.addresses ?? [];
  const primaryAddress = allAddresses[0];

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

  const ip = getRequestIp(request);

  await ensureSchema();
  await ensureUserAddressSchema();

  const id = crypto.randomUUID();

  const [user] = await sql`
    INSERT INTO users (
      id, hca_id, email, display_name, hca_first_name, hca_last_name,
      hca_street_address, hca_locality, hca_region, hca_postal_code, hca_country,
      slack_id, slack_name, slack_avatar_url, verification_status, last_ip,
      hca_addresses
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
      ${JSON.stringify(allAddresses)}
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
      hca_addresses = EXCLUDED.hca_addresses,
      updated_at = NOW()
    RETURNING id, is_admin
  `;

  await sql`
    INSERT INTO ip_visits (id, ip, user_id, visit_type)
    VALUES (${crypto.randomUUID()}, ${ip}, ${user.id}, 'signup')
  `;

  geocodeIp(ip, "users", user.id).catch(() => {});
  geocodeIp(ip, "ip_visits", null, user.id, "signup").catch(() => {});
  linkAnonymousVisits(ip, user.id).catch(() => {});
  linkApplicationsToUser({
    userId: user.id,
    email: email ?? null,
    hcaId,
    slackId: slackId ?? null,
  }).catch(() => {});

  const token = await createToken({
    sub: user.id,
    email: email ?? undefined,
    displayName,
    slackId: slackId ?? undefined,
    isAdmin: user.is_admin,
  });

  await setSession(token);

  return Response.redirect(`${process.env.CURRENT_DOMAIN}/dashboard`);
}
