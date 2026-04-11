import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/database/user-address-schema";

import SettingsClient from "./SettingsClient";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("settings.metadata.title");
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const t = await getTranslations();
  await ensureUserAddressSchema();

  const [user, posterAccessState] = await Promise.all([
    sql`
      SELECT
        display_name, email, hca_first_name, hca_last_name,
        slack_id, slack_name, verification_status,
        ambassador_region, hca_country, country_name, country_code,
        balance_cents, is_admin
      FROM users WHERE id = ${session.sub}
    `,
    getPosterAccessState(session.sub),
  ]);
  const [settingsUser] = user;
  const canAccessAdmin = Boolean(session.impersonator) || Boolean(settingsUser?.is_admin ?? session.isAdmin);
  const showPostersLink = canAccessPosters({
    latestApplicationStatus: posterAccessState?.latest_application_status ?? null,
    manualDashboardState: posterAccessState?.manual_dashboard_state ?? null,
  });

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={settingsUser?.balance_cents ?? 0}
        showPostersLink={showPostersLink}
      />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-4xl text-white">{t("settings.heading")}</h1>
        <hr className="mt-6 border-white/10" />

        <SettingsClient
          displayName={settingsUser?.display_name ?? session.displayName}
          email={settingsUser?.email ?? session.email ?? ""}
          firstName={settingsUser?.hca_first_name ?? ""}
          lastName={settingsUser?.hca_last_name ?? ""}
          slackName={settingsUser?.slack_name ?? ""}
          verificationStatus={settingsUser?.verification_status ?? ""}
          currentRegion={settingsUser?.ambassador_region ?? null}
          detectedRegions={[
            settingsUser?.hca_country ?? null,
            settingsUser?.country_name ?? null,
            settingsUser?.country_code ?? null,
          ]}
        />
      </div>
    </main>
  );
}
