import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { requireEnv } from "@/lib/env";
import { isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PosterLocationRow = {
  latitude: number | string | null;
  longitude: number | string | null;
  cached_address: string | null;
};

// Resolves a poster's coordinates to a street address through the Hack Club
// geocoder (Google-backed, so addresses come back anglicised). The first
// successful lookup is cached on the poster's metadata; later opens are free.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const poster = (await sql<PosterLocationRow[]>`
    SELECT
      latitude,
      longitude,
      NULLIF(TRIM(metadata->>'reverse_geocoded_address'), '') AS cached_address
    FROM posters
    WHERE id = ${id}
    LIMIT 1
  `).at(0) ?? null;

  if (poster === null || poster.latitude === null || poster.longitude === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (poster.cached_address !== null) {
    return Response.json({ address: poster.cached_address });
  }

  const response = await fetch(
    `https://geocoder.hackclub.com/v1/reverse_geocode?lat=${encodeURIComponent(Number(poster.latitude))}&lng=${encodeURIComponent(Number(poster.longitude))}&key=${encodeURIComponent(requireEnv("GEOCODER_KEY"))}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return Response.json({ error: "lookup_failed" }, { status: 502 });
  }

  const data: unknown = await response.json();
  const address =
    typeof data === "object" &&
    data !== null &&
    "formatted_address" in data &&
    typeof data.formatted_address === "string" &&
    data.formatted_address.trim() !== ""
      ? data.formatted_address.trim()
      : null;
  if (address === null) {
    return Response.json({ error: "lookup_failed" }, { status: 502 });
  }

  await sql`
    UPDATE posters
    SET metadata = metadata || jsonb_build_object('reverse_geocoded_address', ${address}::text)
    WHERE id = ${id}
  `;

  return Response.json({ address });
}
