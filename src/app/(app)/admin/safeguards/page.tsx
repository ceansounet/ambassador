import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SafeguardsClient } from "@/components/admin/safeguards-client";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { ensureSchema } from "@/lib/database/ensure-schema";
import {
  listOverridesGroupedByFlag,
  listSafeguardStates,
  SAFEGUARD_KEYS,
} from "@/lib/safeguards";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.safeguards.metadata.title");
}

export default async function AdminSafeguardsPage() {
  const [t] = await Promise.all([getTranslations(), ensureSchema()]);
  const [safeguards, overridesByFlag] = await Promise.all([
    listSafeguardStates(),
    listOverridesGroupedByFlag(),
  ]);
  const stateByKey = new Map(safeguards.map((state) => [state.key, state]));

  return (
    <div className="space-y-8">
      <h1 className="text-4xl leading-[3rem] text-foreground">{t("admin.safeguards.title")}</h1>

      <SafeguardsClient
        errorMessages={{
          update: t("admin.safeguards.errors.update-failed"),
          override: t("admin.safeguards.errors.override-failed"),
        }}
        columns={{
          toggle: t("admin.safeguards.columns.toggle"),
          flag: t("admin.safeguards.columns.flag"),
          description: t("admin.safeguards.columns.description"),
        }}
        overrides={{
          heading: t("admin.safeguards.overrides.heading"),
          empty: t("admin.safeguards.overrides.empty"),
          addLabel: t("admin.safeguards.overrides.add-label"),
          addPlaceholder: t("admin.safeguards.overrides.add-placeholder"),
          addButton: t("admin.safeguards.overrides.add-button"),
          candidatesEmpty: t("admin.safeguards.overrides.candidates-empty"),
          candidatesLoading: t("admin.safeguards.overrides.candidates-loading"),
          removeLabel: t("admin.safeguards.overrides.remove-label"),
          removeConfirm: t("admin.safeguards.overrides.remove-confirm"),
          notFound: t("admin.safeguards.overrides.not-found"),
          alreadyExists: t("admin.safeguards.overrides.already-exists"),
        }}
        controls={[
          {
            key: SAFEGUARD_KEYS.onboardingEnabled,
            title: t("admin.safeguards.onboarding.title"),
            description: t("admin.safeguards.onboarding.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.onboardingEnabled)?.enabled ?? true,
            enableAction: t("admin.safeguards.onboarding.enable"),
            disableAction: t("admin.safeguards.onboarding.disable"),
            overrides: overridesByFlag[SAFEGUARD_KEYS.onboardingEnabled].map((o) => ({
              userId: o.userId,
              displayName: o.displayName,
              email: o.email,
              slackId: o.slackId,
            })),
          },
          {
            key: SAFEGUARD_KEYS.shirtOrderingEnabled,
            title: t("admin.safeguards.shirt-ordering.title"),
            description: t("admin.safeguards.shirt-ordering.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.shirtOrderingEnabled)?.enabled ?? true,
            enableAction: t("admin.safeguards.shirt-ordering.enable"),
            disableAction: t("admin.safeguards.shirt-ordering.disable"),
            overrides: overridesByFlag[SAFEGUARD_KEYS.shirtOrderingEnabled].map((o) => ({
              userId: o.userId,
              displayName: o.displayName,
              email: o.email,
              slackId: o.slackId,
            })),
          },
          {
            key: SAFEGUARD_KEYS.postersEnabled,
            title: t("admin.safeguards.posters.title"),
            description: t("admin.safeguards.posters.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.postersEnabled)?.enabled ?? true,
            enableAction: t("admin.safeguards.posters.enable"),
            disableAction: t("admin.safeguards.posters.disable"),
            overrides: overridesByFlag[SAFEGUARD_KEYS.postersEnabled].map((o) => ({
              userId: o.userId,
              displayName: o.displayName,
              email: o.email,
              slackId: o.slackId,
            })),
          },
          {
            key: SAFEGUARD_KEYS.referralsEnabled,
            title: t("admin.safeguards.referrals.title"),
            description: t("admin.safeguards.referrals.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.referralsEnabled)?.enabled ?? true,
            enableAction: t("admin.safeguards.referrals.enable"),
            disableAction: t("admin.safeguards.referrals.disable"),
            overrides: overridesByFlag[SAFEGUARD_KEYS.referralsEnabled].map((o) => ({
              userId: o.userId,
              displayName: o.displayName,
              email: o.email,
              slackId: o.slackId,
            })),
          },
          {
            key: SAFEGUARD_KEYS.payoutsEnabled,
            title: t("admin.safeguards.payouts.title"),
            description: t("admin.safeguards.payouts.description"),
            enabled: stateByKey.get(SAFEGUARD_KEYS.payoutsEnabled)?.enabled ?? false,
            enableAction: t("admin.safeguards.payouts.enable"),
            disableAction: t("admin.safeguards.payouts.disable"),
            overrides: overridesByFlag[SAFEGUARD_KEYS.payoutsEnabled].map((o) => ({
              userId: o.userId,
              displayName: o.displayName,
              email: o.email,
              slackId: o.slackId,
            })),
          },
        ]}
      />
    </div>
  );
}
