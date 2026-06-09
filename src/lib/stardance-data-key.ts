import { timingSafeEqual } from "node:crypto";

import { optionalEnv } from "@/lib/env";

/**
 * The presented key, taken only from a header. Query-string secrets leak into
 * logs, analytics, and referrers, so `?key=` is not accepted.
 */
function presentedKey(request: Request): string | null {
  const direct = request.headers.get("x-stardance-data-access-key")?.trim();
  if (direct) {
    return direct;
  }

  const auth = request.headers.get("authorization")?.trim();
  if (auth) {
    return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : auth;
  }

  return null;
}

function keysMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guards the Stardance data API. Returns the error response to send, or null
 * when the request presented the shared access key.
 */
export function requireStardanceDataKey(request: Request): Response | null {
  const expectedKey = optionalEnv("STARDANCE_DATA_ACCESS_KEY");
  if (!expectedKey) {
    return Response.json({ error: "This endpoint is not enabled" }, { status: 503 });
  }

  const provided = presentedKey(request);
  if (!provided || !keysMatch(provided, expectedKey)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
