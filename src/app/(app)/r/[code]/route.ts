import { ensureSchema } from "@/lib/database/ensure-schema";
import { optionalEnv } from "@/lib/env";
import { checkRateLimit, getIpRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { findReferralLinkByCode } from "@/lib/referrals";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: RouteContext<"/r/[code]">,
) {
  const { code } = await context.params;

  const rateLimit = await checkRateLimit({
    scope: "referral-redirect",
    key: getIpRateLimitKey(request),
    limit: 200,
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  await ensureSchema();

  const link = /^AMB-[A-Z1-9]{8}$/.test(code.trim().toUpperCase())
    ? await findReferralLinkByCode(code)
    : null;

  if (link === null) {
    return Response.redirect(optionalEnv("CURRENT_DOMAIN") ?? "http://localhost:7171", 302);
  }

  const target = new URL(
    optionalEnv("REFERRAL_REDIRECT_BASE_URL") ??
      optionalEnv("CURRENT_DOMAIN") ??
      "http://localhost:7171",
  );
  target.searchParams.set("ref", link.code);

  return Response.redirect(target.toString(), 302);
}
