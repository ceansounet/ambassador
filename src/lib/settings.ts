export type HackClubAddress = {
  first_name?: string;
  last_name?: string;
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone_number?: string;
};

export const SUPPORTED_AMBASSADOR_REGIONS = [
  "Albania",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Belarus",
  "Belgium",
  "Bosnia and Herzegovina",
  "Bulgaria",
  "Canada",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Kosovo",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Moldova",
  "Monaco",
  "Montenegro",
  "Netherlands",
  "North Macedonia",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "San Marino",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
  "Ukraine",
  "United Kingdom",
  "United States",
] as const;

function isHackClubAddress(value: unknown): value is HackClubAddress {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeHackClubAddresses(value: unknown): HackClubAddress[] {
  if (Array.isArray(value)) {
    return value.filter(isHackClubAddress);
  }

  if (isHackClubAddress(value)) {
    return [value];
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    return normalizeHackClubAddresses(JSON.parse(value) as unknown);
  } catch {
    return [];
  }
}

export function formatHackClubAddress(address: HackClubAddress) {
  return [
    address.line_1,
    address.line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function resolveAmbassadorRegion(
  currentRegion: string | null,
  detectedRegion: string | null,
) {
  if (
    currentRegion &&
    SUPPORTED_AMBASSADOR_REGIONS.includes(
      currentRegion as (typeof SUPPORTED_AMBASSADOR_REGIONS)[number],
    )
  ) {
    return currentRegion;
  }

  if (detectedRegion) {
    const matchedRegion = SUPPORTED_AMBASSADOR_REGIONS.find(
      (region) => region.toLowerCase() === detectedRegion.toLowerCase(),
    );

    if (matchedRegion) {
      return matchedRegion;
    }
  }

  return "United States";
}
