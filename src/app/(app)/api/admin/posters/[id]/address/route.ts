import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { reverseGeocode } from "@/lib/geo";
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

  const geo = await reverseGeocode(Number(poster.latitude), Number(poster.longitude));
  const address = geo?.formatted_address ?? null;
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
