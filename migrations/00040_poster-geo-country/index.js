// Posters now carry the country their GPS coordinates fall in, so the density
// map groups dots by where each poster physically is instead of by the placer's
// account country (IP geolocated, so often wrong: a UK ambassador on a
// US-routed IP counted toward the US). That mismatch had the per-country list
// disagreeing with the dots. Add the columns and backfill existing posters by
// reverse geocoding their coordinates; new posters get tagged on submit. Rows
// the geocoder can't resolve stay null and fall back to the placer's country.

function field(data, name) {
  const value = data == null ? null : data[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function reverseGeocode(lat, lng, key) {
  const res = await fetch(
    `https://geocoder.hackclub.com/v1/reverse_geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&key=${encodeURIComponent(key)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const country_code = field(data, "country_code");
  if (country_code === null) return null;
  return {
    country_code,
    country_name: field(data, "country_name"),
    state: field(data, "state_full") ?? field(data, "state"),
  };
}

module.exports = async function migrate(sql) {
  await sql`
    ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS geo_country_code TEXT,
      ADD COLUMN IF NOT EXISTS geo_country_name TEXT,
      ADD COLUMN IF NOT EXISTS geo_state TEXT
  `;

  const key = process.env.GEOCODER_KEY && process.env.GEOCODER_KEY.trim();
  if (!key) return;

  const rows = await sql`
    SELECT id, latitude AS lat, longitude AS lng
    FROM posters
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  `;

  // The geocoder round-trip is the slow part, so resolve each batch's
  // coordinates concurrently, then write the results sequentially (they share
  // this migration's single transaction connection). A coordinate the geocoder
  // can't place is left null rather than failing the deploy.
  const BATCH = 10;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const geos = await Promise.all(
      batch.map((row) =>
        reverseGeocode(Number(row.lat), Number(row.lng), key).catch(() => null),
      ),
    );
    for (let j = 0; j < batch.length; j += 1) {
      const geo = geos[j];
      if (geo === null) continue;
      await sql`
        UPDATE posters
        SET geo_country_code = ${geo.country_code},
            geo_country_name = ${geo.country_name},
            geo_state = ${geo.state}
        WHERE id = ${batch[j].id}
      `;
    }
  }
};
