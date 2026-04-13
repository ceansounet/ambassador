import type { NextRequest } from "next/server";

import { ensureSchema } from "@/lib/database/ensure-schema";
import {
  linkAnonymousVisits,
  trackAnonymousVisit,
  trackAuthenticatedVisit,
} from "@/lib/geo";
import { getRequestIp, isSameOriginRequest } from "@/lib/http";
import { verifyToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  const ip = getRequestIp(request);
  const token = request.cookies.get("ambassador_token")?.value;

  if (token !== undefined && token !== "") {
    const payload = await verifyToken(token);
    if (payload) {
      await trackAuthenticatedVisit(ip, payload.sub);
      await linkAnonymousVisits(ip, payload.sub);
      return Response.json({ ok: true });
    }
  }

  await trackAnonymousVisit(ip);
  return Response.json({ ok: true });
}
