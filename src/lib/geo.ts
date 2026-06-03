import sql from "@/lib/database/client";
import { requireEnv } from "@/lib/env";
import { resolveDetectedAmbassadorRegion } from "@/lib/settings";

const PRIVATE_RANGES = [
  /^10\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^fc/,
  /^fd/,
  /^fe80/,
];

function isPrivateIp(ip: string): boolean {
  return ip === "unknown" || PRIVATE_RANGES.some((r) => r.test(ip));
}

export type GeoResult = {
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country_name: string | null;
  country_code: string | null;
  postal_code?: string;
  timezone?: string;
  org?: string;
};

type VisitIdRow = {
  id: string;
};

export async function fetchGeo(ip: string): Promise<GeoResult | null> {
  if (isPrivateIp(ip)) return null;

  const res = await fetch(
    `https://geocoder.hackclub.com/v1/geoip?ip=${encodeURIComponent(ip)}&key=${encodeURIComponent(requireEnv("GEOCODER_KEY"))}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) return null;

  const data = await res.json();
  const geo: Record<string, unknown> | null =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? Object.fromEntries(Object.entries(data))
      : null;
  if (geo === null || typeof geo.lat !== "number" || typeof geo.lng !== "number" || typeof geo.error === "string") {
    return null;
  }

  return {
    latitude: geo.lat,
    longitude: geo.lng,
    city: typeof geo.city === "string" && geo.city.trim() !== "" ? geo.city.trim() : null,
    region: typeof geo.region === "string" && geo.region.trim() !== "" ? geo.region.trim() : null,
    country_name: typeof geo.country_name === "string" && geo.country_name.trim() !== "" ? geo.country_name.trim() : null,
    country_code: typeof geo.country_code === "string" && geo.country_code.trim() !== "" ? geo.country_code.trim() : null,
    postal_code: typeof geo.postal_code === "string" && geo.postal_code.trim() !== "" ? geo.postal_code.trim() : undefined,
    timezone: typeof geo.timezone === "string" && geo.timezone.trim() !== "" ? geo.timezone.trim() : undefined,
    org: typeof geo.org === "string" && geo.org.trim() !== "" ? geo.org.trim() : undefined,
  };
}

export async function geocodeIp(
  ip: string,
  table: "users" | "ip_visits" | "applications",
  id: string | null,
  userId?: string,
  visitType?: string,
) {
  const geo = await fetchGeo(ip);
  if (!geo) return;
  const ambassadorRegion =
    resolveDetectedAmbassadorRegion(geo.country_code, geo.country_name) ?? "United States";

  if (table === "users" && id !== null) {
    await sql`
      UPDATE users SET
        latitude = ${geo.latitude},
        longitude = ${geo.longitude},
        city = ${geo.city},
        region = ${geo.region},
        country_code = ${geo.country_code},
        country_name = ${geo.country_name},
        postal_code = ${geo.postal_code ?? null},
        timezone = ${geo.timezone ?? null},
        org = ${geo.org ?? null},
        ambassador_region = CASE
          WHEN ambassador_region = 'Other' AND ${ambassadorRegion} <> 'Other'
            THEN ${ambassadorRegion}
          WHEN ambassador_region IS NULL
            THEN ${ambassadorRegion}
          ELSE ambassador_region
        END,
        geocoded_at = NOW()
      WHERE id = ${id}
    `;
  } else if (table === "applications" && id !== null) {
    await sql`
      UPDATE applications SET
        latitude = ${geo.latitude},
        longitude = ${geo.longitude},
        city = ${geo.city},
        region = ${geo.region},
        country_code = ${geo.country_code},
        country_name = ${geo.country_name},
        geocoded_at = NOW()
      WHERE id = ${id}
    `;
  } else if (
    table === "ip_visits" &&
    userId !== undefined &&
    userId !== "" &&
    visitType !== undefined &&
    visitType !== ""
  ) {
    await sql`
      UPDATE ip_visits SET
        latitude = ${geo.latitude},
        longitude = ${geo.longitude},
        city = ${geo.city},
        region = ${geo.region},
        country_code = ${geo.country_code},
        country_name = ${geo.country_name},
        postal_code = ${geo.postal_code ?? null},
        timezone = ${geo.timezone ?? null},
        org = ${geo.org ?? null},
        geocoded_at = NOW()
      WHERE id = (
        SELECT id
        FROM ip_visits
        WHERE user_id = ${userId} AND visit_type = ${visitType}
        ORDER BY created_at DESC
        LIMIT 1
      )
    `;
  }
}

export async function trackAnonymousVisit(ip: string) {
  if (isPrivateIp(ip)) return;

  const visit = (await sql<VisitIdRow[]>`
    INSERT INTO ip_visits (id, ip, visit_type)
    SELECT ${crypto.randomUUID()}, ${ip}, 'anonymous'
    WHERE NOT EXISTS (
      SELECT 1
      FROM ip_visits
      WHERE ip = ${ip}
        AND visit_type = 'anonymous'
        AND created_at > NOW() - INTERVAL '1 minute'
    )
    RETURNING id
  `).at(0) ?? null;

  if (visit === null) return;

  void geocodeVisit(ip, visit.id).catch((error) => {
    console.error("Failed to geocode anonymous visit", { visitId: visit.id, error });
  });
}

async function geocodeVisit(ip: string, visitId: string) {
  const geo = await fetchGeo(ip);
  if (!geo) return;

  await sql`
    UPDATE ip_visits SET
      latitude = ${geo.latitude},
      longitude = ${geo.longitude},
      city = ${geo.city},
      region = ${geo.region},
      country_code = ${geo.country_code},
      country_name = ${geo.country_name},
      postal_code = ${geo.postal_code ?? null},
      timezone = ${geo.timezone ?? null},
      org = ${geo.org ?? null},
      geocoded_at = NOW()
    WHERE id = ${visitId}
  `;
}

export async function trackAuthenticatedVisit(ip: string, userId: string) {
  if (isPrivateIp(ip)) return;

  const visit = (await sql<VisitIdRow[]>`
    INSERT INTO ip_visits (id, ip, user_id, visit_type)
    SELECT ${crypto.randomUUID()}, ${ip}, ${userId}, 'revisit'
    WHERE NOT EXISTS (
      SELECT 1
      FROM ip_visits
      WHERE user_id = ${userId}
        AND visit_type = 'revisit'
        AND created_at > NOW() - INTERVAL '10 minutes'
    )
    RETURNING id
  `).at(0) ?? null;

  if (visit === null) return;

  void geocodeVisit(ip, visit.id).catch((error) => {
    console.error("Failed to geocode authenticated visit", { visitId: visit.id, error });
  });
}

export async function linkAnonymousVisits(ip: string, userId: string) {
  await sql`
    UPDATE ip_visits SET user_id = ${userId}
    WHERE ip = ${ip} AND user_id IS NULL AND visit_type = 'anonymous'
  `;
}
