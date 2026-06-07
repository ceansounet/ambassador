// Seeds local US (and a few non-US) ambassadors with referrals and posters so
// the admin dashboard's US-only graphs render with meaningful data.
//
//   node --env-file=.env scripts/seed-us-data.mjs   (or: pnpm seed:dev)
//
// Idempotent: every row id is prefixed `seed-`, and a re-run wipes the prior
// seed first. Touches only seed rows; existing data is left alone.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run with `node --env-file=.env ...`.");
  process.exit(1);
}

const sql = postgres(url, { max: 4, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });

// Deterministic RNG so re-runs produce the same shape.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260605);
const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const weighted = (items) => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
// Skew toward recent days so the default 14-day window is populated.
const recentDaysAgo = (max) => new Date(Date.now() - Math.floor(rng() * rng() * max) * 86400000);

// Referral codes are `a-` + 5 chars of [a-z0-9] (the prefixed format the
// users/stardance_referral_codes CHECK constraints enforce).
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
let codeCounter = 0;
function makeCode() {
  let n = 100003 + codeCounter++ * 7919;
  let s = "a-";
  for (let i = 0; i < 5; i++) {
    s += ALPHABET[n % ALPHABET.length];
    n = Math.floor(n / ALPHABET.length) + 17;
  }
  return s;
}

const FIRST = ["Ada", "Bex", "Cyrus", "Dot", "Eli", "Faye", "Gus", "Hana", "Ivo", "Jo", "Kai", "Lux", "Mira", "Nell", "Omar", "Pia", "Quinn", "Rey", "Sol", "Tao", "Uma", "Vik", "Wren", "Xan", "Yael", "Zed"];
const LAST = ["Park", "Reyes", "Okafor", "Singh", "Nguyen", "Brooks", "Hale", "Ito", "Mora", "Frost", "Adeyemi", "Cole", "Vance", "Diaz", "Lund", "Shaw"];

// US ambassadors, distributed across states (popular states get more), so the
// state breakdown shows varied bars.
const US_PLAN = [
  ["California", 3], ["New York", 2], ["Texas", 2], ["Florida", 2],
  ["Washington", 1], ["Illinois", 1], ["Massachusetts", 1], ["Georgia", 1],
  ["Colorado", 1], ["Oregon", 1], ["Pennsylvania", 1], ["Ohio", 1],
];
const NON_US = [
  { region: "Canada", state: "Ontario", cc: "CA", cn: "Canada" },
  { region: "EU", state: "Bavaria", cc: "DE", cn: "Germany" },
  { region: "United Kingdom", state: "England", cc: "GB", cn: "United Kingdom" },
  { region: "Australia", state: "New South Wales", cc: "AU", cn: "Australia" },
];

const REFERRAL_STATUSES = ["verified", "verified", "verified", "pending", "unverified", "rsvp", "rejected"];
const POSTER_STATUSES = ["success", "success", "pending", "in_review", "rejected", "digital"];

// Approximate centres so the density map clusters around real places (and the
// gaps between them read as sparse). US keyed by state, others by country code.
const GEO_CENTERS = {
  California: [36.78, -119.42], "New York": [40.71, -74.0], Texas: [31.0, -99.0],
  Florida: [27.99, -81.76], Washington: [47.4, -120.5], Illinois: [41.88, -87.63],
  Massachusetts: [42.36, -71.06], Georgia: [33.75, -84.39], Colorado: [39.74, -104.99],
  Oregon: [44.0, -120.5], Pennsylvania: [40.0, -77.6], Ohio: [40.0, -82.9],
  CA: [43.65, -79.38], DE: [48.14, 11.58], GB: [52.49, -1.89], AU: [-33.87, 151.21],
};
// Gaussian-ish jitter (sum of two uniforms), so most posters hug the centre and
// a few stray out — clusters stay dense, the periphery stays sparse.
function jitter(spread) {
  return (rng() + rng() - 1) * spread;
}
function geoFor(state, cc) {
  const center = GEO_CENTERS[state] ?? GEO_CENTERS[cc] ?? [39.5, -98.35];
  return [center[0] + jitter(1.4), center[1] + jitter(1.8)];
}

const users = [];
const codes = [];
const referrals = [];
const posters = [];

let i = 0;
function addAmbassador({ region, state, cc, cn, refCount, posterCount }) {
  const id = `seed-${region.toLowerCase().replace(/[^a-z]+/g, "-")}-${i}`;
  const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
  const code = makeCode();
  users.push({
    id,
    hca_id: `seed-hca-${i}`,
    email: `amb-${i}@example.com`,
    display_name: name,
    slack_id: `SEEDAMB${i}`,
    ambassador_region: region,
    region: state,
    country_code: cc,
    country_name: cn,
    manual_dashboard_state: "approved",
    stardance_referral_code: code,
    created_at: recentDaysAgo(120),
  });

  const codeId = `seed-code-${i}`;
  codes.push({ id: codeId, user_id: id, code: makeCode(), label: "Primary", kind: "primary" });

  for (let j = 0; j < refCount; j++) {
    const status = weighted(REFERRAL_STATUSES);
    const at = recentDaysAgo(75);
    // Hours: verified referrals have approved hours; pending have logged-only.
    const hoursLogged =
      status === "verified" ? randInt(5, 40) : status === "pending" ? randInt(2, 20) : 0;
    const hoursApproved = status === "verified" ? randInt(3, hoursLogged) : 0;
    referrals.push({
      id: `seed-ref-${i}-${j}`,
      user_id: id,
      referral_code_id: codeId,
      name: `${FIRST[(i + j) % FIRST.length]} ${LAST[(i + j + 3) % LAST.length]}`,
      slack_id: `SEEDREF${i}X${j}`,
      email: `referred-${i}-${j}@example.com`,
      hours_logged: hoursLogged,
      hours_approved: hoursApproved,
      verification_status: status,
      referred_at: at,
      created_at: at,
    });
  }

  for (let j = 0; j < posterCount; j++) {
    const status = weighted(POSTER_STATUSES);
    const at = recentDaysAgo(75);
    const [latitude, longitude] = geoFor(state, cc);
    posters.push({
      id: `seed-poster-${i}-${j}`,
      user_id: id,
      campaign_slug: "stardance",
      qr_code_token: `seed-qr-${i}-${j}`,
      referral_code: makeCode(),
      poster_type: "color",
      verification_status: status,
      latitude,
      longitude,
      location_accuracy: randInt(5, 60),
      verified_at: status === "success" ? at : null,
      submitted_at: at,
      created_at: at,
    });
  }
  i++;
}

for (const [state, count] of US_PLAN) {
  for (let k = 0; k < count; k++) {
    addAmbassador({
      region: "United States",
      state,
      cc: "US",
      cn: "United States",
      refCount: randInt(4, 16),
      posterCount: randInt(4, 12),
    });
  }
}
for (const a of NON_US) {
  addAmbassador({ ...a, refCount: randInt(3, 9), posterCount: randInt(3, 8) });
}

async function main() {
  await sql.begin(async (tx) => {
    // Wipe prior seed (children first; deleting referrals/posters fires balance
    // clawback events, which we then clear before removing the users).
    await tx`DELETE FROM stardance_referrals WHERE id LIKE 'seed-%'`;
    await tx`DELETE FROM posters WHERE id LIKE 'seed-%'`;
    await tx`DELETE FROM payout_balance_events WHERE user_id LIKE 'seed-%'`;
    await tx`DELETE FROM stardance_referral_codes WHERE id LIKE 'seed-%'`;
    await tx`DELETE FROM users WHERE id LIKE 'seed-%'`;

    await tx`INSERT INTO users ${tx(users, "id", "hca_id", "email", "display_name", "slack_id", "ambassador_region", "region", "country_code", "country_name", "manual_dashboard_state", "stardance_referral_code", "created_at")}`;
    await tx`INSERT INTO stardance_referral_codes ${tx(codes, "id", "user_id", "code", "label", "kind")}`;
    await tx`INSERT INTO stardance_referrals ${tx(referrals, "id", "user_id", "referral_code_id", "name", "slack_id", "email", "hours_logged", "hours_approved", "verification_status", "referred_at", "created_at")}`;
    await tx`INSERT INTO posters ${tx(posters, "id", "user_id", "campaign_slug", "qr_code_token", "referral_code", "poster_type", "verification_status", "latitude", "longitude", "location_accuracy", "verified_at", "submitted_at", "created_at")}`;
  });

  const usCount = users.filter((u) => u.ambassador_region === "United States").length;
  const verified = referrals.filter((r) => r.verification_status === "verified").length;
  console.log(
    `Seeded ${users.length} ambassadors (${usCount} US), ${codes.length} codes, ` +
      `${referrals.length} referrals (${verified} verified), ${posters.length} posters.`,
  );
}

main()
  .then(() => sql.end())
  .catch(async (error) => {
    console.error("Seed failed:", error.message);
    await sql.end();
    process.exit(1);
  });
