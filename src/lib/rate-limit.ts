import "server-only";

import { createHash } from "node:crypto";

import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getRequestIp } from "@/lib/http";

type RateLimitOptions = {
  scope: string;
  key: string;
  limit: number;
  windowSeconds?: number;
};

type RateLimitBucketRow = {
  request_count: number;
  reset_at: Date;
  database_now: Date;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export function getRateLimitKey(...parts: Array<string | null | undefined>) {
  const input = parts
    .map((part) => {
      const trimmed = part?.trim();
      return trimmed !== undefined && trimmed !== "" ? trimmed : "unknown";
    })
    .join("\0");
  return createHash("sha256").update(input).digest("hex");
}

export function getIpRateLimitKey(request: Request) {
  return getRateLimitKey(getRequestIp(request));
}

export async function checkRateLimit({
  scope,
  key,
  limit,
  windowSeconds = 60 * 60,
}: RateLimitOptions): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const safeWindowSeconds = Math.max(1, Math.trunc(windowSeconds));

  await ensureSchema();

  const bucket = (await sql<RateLimitBucketRow[]>`
    INSERT INTO rate_limit_buckets (scope, rate_key, window_start, request_count, updated_at)
    VALUES (${scope}, ${key}, NOW(), 1, NOW())
    ON CONFLICT (scope, rate_key)
    DO UPDATE SET
      window_start = CASE
        WHEN rate_limit_buckets.window_start <= NOW() - make_interval(secs => ${safeWindowSeconds}::double precision)
          THEN NOW()
        ELSE rate_limit_buckets.window_start
      END,
      request_count = CASE
        WHEN rate_limit_buckets.window_start <= NOW() - make_interval(secs => ${safeWindowSeconds}::double precision)
          THEN 1
        ELSE rate_limit_buckets.request_count + 1
      END,
      updated_at = NOW()
    RETURNING
      request_count,
      window_start + make_interval(secs => ${safeWindowSeconds}::double precision) AS reset_at,
      NOW() AS database_now
  `).at(0);

  const count = bucket?.request_count ?? safeLimit + 1;
  const resetAt = bucket?.reset_at ?? new Date(Date.now() + safeWindowSeconds * 1000);
  const databaseNow = bucket?.database_now ?? new Date();
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt.getTime() - databaseNow.getTime()) / 1000),
  );

  return {
    ok: count <= safeLimit,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - count),
    resetAt,
    retryAfterSeconds,
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: "rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
      },
    },
  );
}
