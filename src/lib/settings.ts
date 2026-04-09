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

function isHackClubAddress(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readAddressField(
  address: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function coerceHackClubAddress(value: unknown): HackClubAddress | null {
  if (typeof value === "string") {
    try {
      return coerceHackClubAddress(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }

  if (!isHackClubAddress(value)) {
    return null;
  }

  const address: HackClubAddress = {
    first_name: readAddressField(value, "first_name", "firstName"),
    last_name: readAddressField(value, "last_name", "lastName"),
    line_1: readAddressField(value, "line_1", "line1", "address_line_1", "addressLine1"),
    line_2: readAddressField(value, "line_2", "line2", "address_line_2", "addressLine2"),
    city: readAddressField(value, "city", "locality"),
    state: readAddressField(value, "state", "region"),
    postal_code: readAddressField(
      value,
      "postal_code",
      "postalCode",
      "zip",
      "zipcode",
      "address_zip",
      "addressZip",
    ),
    country: readAddressField(
      value,
      "country",
      "country_name",
      "countryName",
      "address_country",
      "addressCountry",
    ),
    phone_number: readAddressField(value, "phone_number", "phoneNumber"),
  };

  return Object.values(address).some(Boolean) ? address : null;
}

export function normalizeHackClubAddresses(value: unknown): HackClubAddress[] {
  if (Array.isArray(value)) {
    return value
      .map((address) => coerceHackClubAddress(address))
      .filter((address): address is HackClubAddress => !!address);
  }

  const address = coerceHackClubAddress(value);
  if (address) {
    return [address];
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
  const normalizedAddress = coerceHackClubAddress(address);
  if (!normalizedAddress) {
    return false;
  }

  return Boolean(
    normalizedAddress.line_1?.trim() &&
      normalizedAddress.city?.trim() &&
      normalizedAddress.state?.trim() &&
      normalizedAddress.postal_code?.trim() &&
      normalizedAddress.country?.trim(),
  );
}

export function formatHackClubAddress(address: unknown) {
  const normalizedAddress = coerceHackClubAddress(address);
  if (!normalizedAddress) {
    return "";
  }

  const locality = [
    normalizedAddress.city,
    normalizedAddress.state,
    normalizedAddress.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    normalizedAddress.line_1,
    normalizedAddress.line_2,
    locality,
    normalizedAddress.country,
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
