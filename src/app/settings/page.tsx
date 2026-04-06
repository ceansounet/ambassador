import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import sql from "@/lib/db";
import { normalizeHackClubAddresses } from "@/lib/settings";
import { getSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/user-address-schema";

import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const t = await getTranslations();
  await ensureUserAddressSchema();

  const [user] = await sql`
    SELECT
      display_name, email, hca_first_name, hca_last_name,
      slack_id, slack_name, verification_status,
      hca_street_address, hca_locality, hca_region, hca_postal_code, hca_country,
      hca_addresses, selected_address_index, ambassador_region,
      balance_cents, is_admin, city, region, country_name, country_code
    FROM users WHERE id = ${session.sub}
  `;

  const addresses = normalizeHackClubAddresses(user?.hca_addresses);
  const selectedAddressIndex =
    Number.isInteger(user?.selected_address_index) && user.selected_address_index >= 0
      ? Math.min(user.selected_address_index, Math.max(addresses.length - 1, 0))
      : 0;

  return (
    <main className="page-shell">
      <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-4xl text-white">{t("settings.heading")}</h1>
        <hr className="mt-6 border-white/10" />

        <SettingsClient
          displayName={user?.display_name ?? session.displayName}
          email={user?.email ?? session.email ?? ""}
          firstName={user?.hca_first_name ?? ""}
          lastName={user?.hca_last_name ?? ""}
          slackName={user?.slack_name ?? ""}
          verificationStatus={user?.verification_status ?? ""}
          addresses={addresses}
          selectedAddressIndex={selectedAddressIndex}
          currentRegion={user?.ambassador_region ?? null}
          detectedRegion={user?.country_name ?? null}
        />
      </div>
    </main>
  );
}
