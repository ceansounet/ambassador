import sql from "./db";
import { requireEnv } from "./env";

const PRIVATE_RANGES = [
  /^10\./,
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

type GeoResult = {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  postal_code?: string;
  timezone?: string;
  org?: string;
};

async function fetchGeo(ip: string): Promise<GeoResult | null> {
  if (isPrivateIp(ip)) return null;

  const res = await fetch(
    `https://geocoder.hackclub.com/v1/geoip?ip=${encodeURIComponent(ip)}`,
    {
      headers: { Authorization: `Bearer ${requireEnv("GEOCODER_KEY")}` },
    },
  );

  if (!res.ok) return null;
  return res.json();
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

  geocodeVisit(ip, visitId).catch(() => {});
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

  geocodeVisit(ip, visitId).catch(() => {});
}

export async function linkAnonymousVisits(ip: string, userId: string) {
  await sql`
    UPDATE ip_visits SET user_id = ${userId}
    WHERE ip = ${ip} AND user_id IS NULL AND visit_type = 'anonymous'
  `;
}
