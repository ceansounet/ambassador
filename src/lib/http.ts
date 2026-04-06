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

export function isSameOriginRequest(request: Request) {
  const requestOrigin =
    toOrigin(request.headers.get("origin")) ??
    toOrigin(request.headers.get("referer"));

  if (!requestOrigin) return false;

  return requestOrigin === new URL(request.url).origin;
}
