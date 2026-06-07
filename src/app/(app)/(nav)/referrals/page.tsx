import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getPosterAccessState } from "@/lib/posters/access";
import { getEffectiveSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import {
  canAccessStardanceReferrals,
  listArchivedStardanceReferralCodesForUser,
  listStardanceReferralCodesForUser,
  listStardanceReferralsForUser,
  syncStardanceRsvpReferralsForUser,
} from "@/lib/stardance-referrals";

import { ReferralsClient } from "./ReferralsClient";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("referrals.metadata.title");
}

export default async function ReferralsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  await ensureSchema();
  const [t, safeguards] = await Promise.all([
    getTranslations(),
    getEffectiveSafeguards(session.sub),
  ]);

  const user = await getPosterAccessState(session.sub);
  const canAccessAdmin = Boolean(session.impersonator) || user?.is_admin === true;

  const canUseReferrals = canAccessStardanceReferrals({
    latestApplicationStatus: user?.latest_application_status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
    isOnboardingComplete: user?.is_onboarding_complete ?? false,
    isAdmin: canAccessAdmin,
  });

  if (user === null || !canUseReferrals || !safeguards.referralsEnabled) {
    forbidden();
  }

  try {
    await syncStardanceRsvpReferralsForUser(session.sub);
  } catch (error) {
    console.error("[stardance-referrals] unable to sync RSVP referrals", error);
  }

  const [referralCodes, archivedReferralCodes, referrals] = await Promise.all([
    listStardanceReferralCodesForUser(session.sub),
    listArchivedStardanceReferralCodesForUser(session.sub),
    listStardanceReferralsForUser(session.sub),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12">
      <header className="mb-6 sm:mb-10">
        <h1 className="font-sub text-4xl font-bold leading-[3rem] text-foreground">{t("referrals.heading")}</h1>
        <p className="mt-2 text-base text-muted-foreground">{t("referrals.subheading")}</p>
      </header>
      <ReferralsClient
        referralCodes={referralCodes}
        archivedReferralCodes={archivedReferralCodes}
        referrals={referrals}
      />
    </div>
  );
}
