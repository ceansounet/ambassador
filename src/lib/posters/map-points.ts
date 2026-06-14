import type { PosterMapDatum } from "@/components/admin/poster-density-map";
import sql from "@/lib/database/client";
import { formatPosterLabel } from "@/lib/posters/format";

type PosterPointRow = {
  id: string;
  lat: number | string;
  lng: number | string;
  country_code: string;
  country_name: string;
  state: string;
  is_us: boolean | null;
  user_id: string | null;
  placed_by: string | null;
  name: string | null;
  referral_code: string;
  poster_group_id: string | null;
  group_name: string | null;
};

// Every verified poster with coordinates, for the density maps. The map groups
// US points by state and the rest by country, so carry both names plus the
// program-region US flag the admin dashboard scope filters on. Country/state
// come from where the poster's coordinates actually fall (geo_*, reverse
// geocoded on submit or by the backfill), falling back to the placer's account
// location until a row is geocoded, so the per-country list matches the dots.
// The placer is only attached for the admin map; the ambassador-facing map
// stays anonymous. When `viewerId` is set, that viewer's own posters carry a
// label so the ambassador map can mark them and show their name on hover; other
// people's posters never carry one, so nothing identifying leaves the server.
// The admin map (`includePlacer`) also carries each poster's group so it can be
// filtered by group; the ambassador map never sees other people's groups.
export async function loadPosterMapPoints(
  { includePlacer = false, viewerId }: { includePlacer?: boolean; viewerId?: string } = {},
): Promise<PosterMapDatum[]> {
  const rows = await sql<PosterPointRow[]>`
    SELECT
      p.id,
      p.latitude AS lat,
      p.longitude AS lng,
      COALESCE(NULLIF(p.geo_country_code, ''), NULLIF(u.country_code, ''), 'XX') AS country_code,
      COALESCE(NULLIF(p.geo_country_name, ''), NULLIF(u.country_name, ''), NULLIF(u.country_code, ''), 'Unknown') AS country_name,
      COALESCE(NULLIF(p.geo_state, ''), NULLIF(TRIM(u.region), ''), 'Unknown') AS state,
      (u.ambassador_region = 'United States') AS is_us,
      u.id AS user_id,
      u.display_name AS placed_by,
      p.name,
      p.referral_code,
      p.poster_group_id,
      g.name AS group_name
    FROM posters p
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN poster_groups g ON g.id = p.poster_group_id
    WHERE p.verification_status = 'success'
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
  `;

  return rows.map((row) => {
    const mine = viewerId !== undefined && row.user_id === viewerId;
    return {
      id: row.id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      country: row.country_code,
      countryName: row.country_name,
      state: row.state,
      isUS: row.is_us === true,
      ...(mine
        ? {
            mine: true,
            label: formatPosterLabel({
              name: row.name,
              referralCode: row.referral_code,
              groupName: row.group_name,
            }),
          }
        : {}),
      ...(includePlacer && row.user_id !== null && row.placed_by !== null
        ? { placedBy: { id: row.user_id, name: row.placed_by } }
        : {}),
      ...(includePlacer && row.poster_group_id !== null
        ? { groupId: row.poster_group_id, groupName: row.group_name }
        : {}),
    };
  });
}
