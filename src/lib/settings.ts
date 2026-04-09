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
  "Australia",
  "Canada",
  "EU",
  "United Kingdom",
  "United States",
  "Other",
] as const;

const EU_COUNTRY_NAMES = new Set([
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "cyprus",
  "czechia",
  "denmark",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hungary",
  "ireland",
  "italy",
  "latvia",
  "lithuania",
  "luxembourg",
  "malta",
  "netherlands",
  "poland",
  "portugal",
  "romania",
  "slovakia",
  "slovenia",
  "spain",
  "sweden",
]);

const REGION_ALIASES: Record<
  string,
  (typeof SUPPORTED_AMBASSADOR_REGIONS)[number]
> = {
  "czech republic": "EU",
  "europe": "EU",
  "european union": "EU",
  "great britain": "United Kingdom",
  "england": "United Kingdom",
  "northern ireland": "United Kingdom",
  "scotland": "United Kingdom",
  "uk": "United Kingdom",
  "united kingdom of great britain and northern ireland": "United Kingdom",
  "u.k.": "United Kingdom",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "usa": "United States",
  "us": "United States",
  "united states of america": "United States",
  "wales": "United Kingdom",
};

function normalizeRegionName(value: string) {
  return value.trim().toLowerCase();
}

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

export function isCompleteHackClubAddress(address: HackClubAddress) {
  return Boolean(
    address.line_1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      address.postal_code?.trim() &&
      address.country?.trim(),
  );
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
    const normalizedDetectedRegion = normalizeRegionName(detectedRegion);
    const matchedRegion = SUPPORTED_AMBASSADOR_REGIONS.find(
      (region) => normalizeRegionName(region) === normalizedDetectedRegion,
    );

    if (matchedRegion) {
      return matchedRegion;
    }

    const aliasedRegion = REGION_ALIASES[normalizedDetectedRegion];
    if (aliasedRegion) {
      return aliasedRegion;
    }

    if (EU_COUNTRY_NAMES.has(normalizedDetectedRegion)) {
      return "EU";
    }

    return "Other";
  }

  return "United States";
}
