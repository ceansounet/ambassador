import { optionalEnv } from "@/lib/env";

export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getSafeRedirectPath(
  value: FormDataEntryValue | string | null | undefined,
  fallbackPath: string,
) {
  const path = typeof value === "string" ? value.trim() : "";

  return path.startsWith("/") && !path.startsWith("//") ? path : fallbackPath;
}

function toOrigin(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function splitHeaderValues(value: string | null) {
  return value
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];
}

function getRequestOrigins(request: Request) {
  const requestUrl = new URL(request.url);
  const origins = new Set<string>([requestUrl.origin]);
  const configuredOrigin = toOrigin(optionalEnv("CURRENT_DOMAIN"));

  if (configuredOrigin) {
    origins.add(configuredOrigin);
  }

  const forwardedHosts = splitHeaderValues(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  const forwardedProtos = splitHeaderValues(request.headers.get("x-forwarded-proto"));
  const protos =
    forwardedProtos.length > 0 ? forwardedProtos : [requestUrl.protocol.slice(0, -1)];

  for (const host of forwardedHosts) {
    for (const proto of protos) {
      origins.add(`${proto}://${host}`);
    }
  }

  return origins;
}

export function isSameOriginRequest(request: Request) {
  const requestOrigin =
    toOrigin(request.headers.get("origin")) ??
    toOrigin(request.headers.get("referer"));

  if (!requestOrigin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite) {
      return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
    }

    // Some browser form submits omit origin metadata entirely. The session cookie is SameSite=Lax,
    // so explicit cross-site POSTs still won't be authenticated.
    return true;
  }

  return getRequestOrigins(request).has(requestOrigin);
}
