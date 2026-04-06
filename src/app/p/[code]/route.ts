import { getRequestIp } from "@/lib/posters/http";
import { resolvePublicPosterScan } from "@/lib/posters/service";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/p/[code]">) {
  const { code } = await context.params;
  const resolved = await resolvePublicPosterScan(code, {
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  });

  if (!resolved) {
    return Response.redirect(process.env.CURRENT_DOMAIN ?? "http://localhost:7171", 302);
  }

  return Response.redirect(resolved.redirectUrl, 302);
}
