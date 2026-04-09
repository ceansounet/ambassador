import sql from "@/lib/database/client";
import { requireEnv } from "@/lib/env";

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

type GeocoderResponse = {
  lat?: number;
  lng?: number;
  city?: string;
  region?: string;
  country_name?: string;
  country_code?: string;
  postal_code?: string;
  timezone?: string;
  org?: string;
  error?: string;
};

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

export async function fetchGeo(ip: string): Promise<GeoResult | null> {
  if (isPrivateIp(ip)) return null;

  const res = await fetch(
    `https://geocoder.hackclub.com/v1/geoip?ip=${encodeURIComponent(ip)}&key=${encodeURIComponent(requireEnv("GEOCODER_KEY"))}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) return null;

  const geo = (await res.json()) as GeocoderResponse;
  if (geo.error || typeof geo.lat !== "number" || typeof geo.lng !== "number") {
    return null;
  }

  return {
    latitude: geo.lat,
    longitude: geo.lng,
    city: geo.city?.trim() || null,
    region: geo.region?.trim() || null,
    country_name: geo.country_name?.trim() || null,
    country_code: geo.country_code?.trim() || null,
    postal_code: geo.postal_code?.trim() || undefined,
    timezone: geo.timezone?.trim() || undefined,
    org: geo.org?.trim() || undefined,
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

  if (table === "users" && id) {
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
        geocoded_at = NOW()
      WHERE id = ${id}
    `;
  } else if (table === "applications" && id) {
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
  } else if (table === "ip_visits" && userId && visitType) {
    const [visit] = await sql`
      SELECT id FROM ip_visits
      WHERE user_id = ${userId} AND visit_type = ${visitType}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (visit) {
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
        WHERE id = ${visit.id}
      `;
    }
  }
}

export async function trackAnonymousVisit(ip: string) {
  if (isPrivateIp(ip)) return;

  const [recent] = await sql`
    SELECT id FROM ip_visits
    WHERE ip = ${ip} AND visit_type = 'anonymous'
    AND created_at > NOW() - INTERVAL '1 minute'
    ORDER BY created_at DESC LIMIT 1
  `;

  if (recent) return;

  const visitId = crypto.randomUUID();
  await sql`
    INSERT INTO ip_visits (id, ip, visit_type)
    VALUES (${visitId}, ${ip}, 'anonymous')
  `;

  void geocodeVisit(ip, visitId).catch((error) => {
    console.error("Failed to geocode anonymous visit", { visitId, error });
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

  const [recent] = await sql`
    SELECT id FROM ip_visits
    WHERE user_id = ${userId} AND visit_type = 'revisit'
    AND created_at > NOW() - INTERVAL '10 minutes'
    ORDER BY created_at DESC LIMIT 1
  `;

  if (recent) return;

  const visitId = crypto.randomUUID();
  await sql`
    INSERT INTO ip_visits (id, ip, user_id, visit_type)
    VALUES (${visitId}, ${ip}, ${userId}, 'revisit')
  `;

  void geocodeVisit(ip, visitId).catch((error) => {
    console.error("Failed to geocode authenticated visit", { visitId, error });
  });
}

export async function linkAnonymousVisits(ip: string, userId: string) {
  await sql`
    UPDATE ip_visits SET user_id = ${userId}
    WHERE ip = ${ip} AND user_id IS NULL AND visit_type = 'anonymous'
  `;
}
