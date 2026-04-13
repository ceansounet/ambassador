import { fetchHackClubAddresses } from "@/lib/auth";
import sql from "@/lib/database/client";
import {
  isCompleteHackClubAddress,
  normalizeHackClubAddresses,
  type HackClubAddress,
} from "@/lib/settings";

type LoadUserHackClubAddressesInput = {
  userId: string;
  storedAddresses: unknown;
  accessToken: string | null;
};

export async function cacheHackClubAddresses(userId: string, addresses: HackClubAddress[]) {
  const normalizedAddresses = normalizeHackClubAddresses(addresses);
  const primaryAddress = normalizedAddresses.at(0) ?? null;
  const primaryAddressLine1 = primaryAddress?.line_1 ?? null;
  const primaryAddressCity = primaryAddress?.city ?? null;
  const primaryAddressState = primaryAddress?.state ?? null;
  const primaryAddressPostalCode = primaryAddress?.postal_code ?? null;
  const primaryAddressCountry = primaryAddress?.country ?? null;

  await sql`
    UPDATE users
    SET
      hca_street_address = ${primaryAddressLine1},
      hca_locality = ${primaryAddressCity},
      hca_region = ${primaryAddressState},
      hca_postal_code = ${primaryAddressPostalCode},
      hca_country = ${primaryAddressCountry},
      hca_addresses = CAST(${JSON.stringify(normalizedAddresses)} AS JSONB),
      updated_at = NOW()
    WHERE id = ${userId}
  `;

  return normalizedAddresses;
}

export async function loadUserHackClubAddresses({
  userId,
  storedAddresses,
  accessToken,
}: LoadUserHackClubAddressesInput) {
  const cachedAddresses = normalizeHackClubAddresses(storedAddresses).filter(
    isCompleteHackClubAddress,
  );

  if (cachedAddresses.length > 0) {
    return {
      addresses: cachedAddresses,
      needsAddressRefresh: false,
    };
  }

  if (accessToken === null || accessToken === "") {
    return {
      addresses: [],
      needsAddressRefresh: true,
    };
  }

  try {
    const addresses = await cacheHackClubAddresses(
      userId,
      normalizeHackClubAddresses(await fetchHackClubAddresses(accessToken)),
    );

    return {
      addresses: addresses.filter(isCompleteHackClubAddress),
      needsAddressRefresh: false,
    };
  } catch (error) {
    console.error("Failed to hydrate cached Hack Club Auth addresses", {
      userId,
      error,
    });

    return {
      addresses: [],
      needsAddressRefresh: false,
    };
  }
}
