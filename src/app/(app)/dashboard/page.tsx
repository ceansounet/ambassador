import Icon from "@hackclub/icons";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { useId, type ComponentProps, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { DevAdminSelector } from "@/components/dev-admin-selector";
import { Navbar } from "@/components/navbar";
import { buttonVariants } from "@/components/ui/button";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import {
  AMBASSADOR_ONBOARDING_STATUS,
  getAmbassadorOnboardingStatus,
} from "@/lib/ambassadors/airtable";
import {
  APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS,
  isAcceptedApplicationStatus,
  isPendingApplicationStatus,
  isRejectedApplicationStatus,
  isRejectedPermanentlyApplicationStatus,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { canShowDevAdminSelector, isDevState, type DevState } from "@/lib/dev-admin-selector";
import { ensureSchema } from "@/lib/database/ensure-schema";
import {
  getOfficeGrantDashboardMessage,
  refreshOfficeGrantBalanceForUser,
  type OfficeGrantRecord,
} from "@/lib/hcb/grants";
import { loadUserHackClubAddresses } from "@/lib/hca-addresses";
import { readHcaAccessToken } from "@/lib/hca-access-token";
import { canAccessPosters } from "@/lib/posters/access";
import { getSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import { canAccessShirts } from "@/lib/shirt/access";
import {
  resolveAmbassadorRegion,
  type HackClubAddress,
} from "@/lib/settings";
import {
  buildWarehousePublicOrderUrl,
  buildWarehouseTrackingUrl,
  SHIRT_SKU_PREFIX,
} from "@/lib/shop";
import { isUserManualDashboardState } from "@/lib/user-dashboard-state";
import { cn } from "@/lib/utils";
import { parseWarehouseOrderResponse } from "@/lib/warehouse";

import ShirtOrderSection, {
  type ShirtOrderSectionProps,
  type ShirtOrderState,
} from "./shirt-order";

type DashboardTranslations = (key: string, values?: Record<string, number | string>) => string;
type IconGlyph = NonNullable<ComponentProps<typeof Icon>["glyph"]>;
type Tone = "primary" | "accent" | "acceptance" | "rejection";
type StepKey = "apply" | "verify" | "review" | "decision";
type Decision = "approved" | "rejected" | "banned" | null;
type ResolvedState = {
  node: ReactNode;
  activeStep: StepKey | null;
  decision: Decision;
  devState: DevState;
};

type ShirtOrderRow = {
  id: string;
  status: string;
  variant: string | null;
  warehouse_order_id: string | null;
  warehouse_payload: unknown | null;
  note: string | null;
};

type ApplicationRow = {
  id: string;
  status: string;
  name: string;
  created_at: string;
  airtable_record_id: string | null;
  airtable_payload: unknown;
};

type UserRow = {
  balance_cents: number | null;
  is_admin: boolean | null;
  ambassador_region: string | null;
  hca_country: string | null;
  country_name: string | null;
  country_code: string | null;
  hca_addresses: unknown;
  hca_access_token: string | null;
  manual_dashboard_state: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("dashboard.metadata.title");
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ devState?: DevState | string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  await ensureSchema();
  const [t, locale, { devState }, safeguards] = await Promise.all([
    getTranslations(),
    getLocale(),
    searchParams,
    getSafeguards(),
  ]);

  const [application, user, existingOrderRow] = await Promise.all([
    sql<ApplicationRow[]>`
      SELECT id, status, name, created_at, airtable_record_id, airtable_payload
      FROM applications WHERE user_id = ${session.sub}
      ORDER BY created_at DESC LIMIT 1
    `.then((rows) => rows.at(0) ?? null),
    sql<UserRow[]>`
      SELECT balance_cents, is_admin, ambassador_region, hca_country, country_name, country_code,
             hca_addresses, hca_access_token, manual_dashboard_state
      FROM users WHERE id = ${session.sub}
    `.then((rows) => rows.at(0) ?? null),
    sql<ShirtOrderRow[]>`
      SELECT id, status, variant, warehouse_order_id, warehouse_payload, note
      FROM orders
      WHERE user_id = ${session.sub} AND sku LIKE ${`${SHIRT_SKU_PREFIX}%`}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `.then((rows) => rows.at(0) ?? null),
  ]);

  if (!user) {
    redirect("/");
  }

  const canAccessShirtOrdering = canAccessShirts({
    latestApplicationStatus: application?.status ?? null,
    manualDashboardState: user.manual_dashboard_state,
  });
  const canUseShirts = canAccessShirtOrdering && safeguards.shirtOrderingEnabled;
  const shirtOnboardingStatus = canAccessShirtOrdering
    ? await getAmbassadorOnboardingStatus({
        applicationAirtableRecordId: application?.airtable_record_id ?? null,
        applicationAirtablePayload: application?.airtable_payload ?? null,
      })
    : {
        hasAmbassadorRecord: false,
        status: AMBASSADOR_ONBOARDING_STATUS.unsubmitted,
        isOnboardingComplete: false,
      };
  const shirtRequiresOnboarding =
    canAccessShirtOrdering &&
    (!shirtOnboardingStatus.hasAmbassadorRecord ||
      !shirtOnboardingStatus.isOnboardingComplete);
  const shouldLoadShirtAddresses = canUseShirts && !shirtRequiresOnboarding;
  let shirtNeedsAddressRefresh = false;
  let shirtAddresses: HackClubAddress[] = [];
  const hcaAccessToken = readHcaAccessToken(user.hca_access_token);

  if (shouldLoadShirtAddresses) {
    const addressState = await loadUserHackClubAddresses({
      userId: session.sub,
      storedAddresses: user.hca_addresses,
      accessToken: hcaAccessToken,
    });

    shirtAddresses = addressState.addresses;
    shirtNeedsAddressRefresh = addressState.needsAddressRefresh;
  }
  const warehouseOrder = existingOrderRow
    ? parseWarehouseOrderResponse(existingOrderRow.warehouse_payload)
    : null;
  const warehouseOrderId =
    existingOrderRow?.warehouse_order_id ?? warehouseOrder?.id ?? null;
  const shirtExistingOrder: ShirtOrderState | null = existingOrderRow
    ? {
        id: existingOrderRow.id,
        status: existingOrderRow.status,
        size: existingOrderRow.variant,
        warehouseUrl: warehouseOrderId === null ? null : buildWarehouseTrackingUrl(warehouseOrderId),
        publicOrderUrl: warehouseOrderId === null ? null : buildWarehousePublicOrderUrl(warehouseOrderId),
        note: existingOrderRow.note,
      }
    : null;
  const shirt: ShirtOrderSectionProps = {
    addresses: shirtAddresses,
    needsAddressRefresh: shirtNeedsAddressRefresh,
    existingOrder: shirtExistingOrder,
    requiresOnboarding: shirtRequiresOnboarding,
    onboardingStatus: shirtOnboardingStatus.status,
    onboardingFormUrl: "https://forms.hackclub.com/t/mJvXsYY41Lus",
  };

  const canAccessAdmin = Boolean(session.impersonator) || Boolean(user.is_admin ?? session.isAdmin);
  const canUseSelector = canShowDevAdminSelector(canAccessAdmin);
  const officeGrant = await refreshOfficeGrantBalanceForUser(session.sub);
  const stateInput = {
    application,
    user,
    locale,
    fakeDate: new Date().toISOString(),
    t,
    shirt,
    officeGrant,
    canUseShirts,
    onboardingEnabled: safeguards.onboardingEnabled,
  };
  const baseResolved = resolveState({ ...stateInput, activeDevState: null });
  const selectedDevState = devState !== undefined && isDevState(devState) ? devState : null;
  const resolved = canUseSelector && selectedDevState !== null
    ? resolveState({ ...stateInput, activeDevState: selectedDevState })
    : baseResolved;

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={user.balance_cents ?? 0}
        showPostersLink={canAccessPosters({
          latestApplicationStatus: application?.status ?? null,
          manualDashboardState: user.manual_dashboard_state,
        })}
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="flex items-center gap-2 md:gap-3">
          <h1 className="font-sub text-4xl leading-none text-white md:text-5xl">
            {t("dashboard.heading", { name: session.displayName })}
          </h1>
          {resolved.decision === "approved" ? (
            <AmbassadorCircleText
              className="h-14 w-14 shrink-0 md:h-16 md:w-16"
              slackId={session.slackId}
              fallbackName={session.displayName}
            />
          ) : null}
        </header>

        {resolved.activeStep ? (
          <div className="mt-8">
            <JourneyStepper activeStep={resolved.activeStep} decision={resolved.decision} t={t} />
          </div>
        ) : null}

        <div className="mt-6">{resolved.node}</div>
      </div>
      {canUseSelector && <DevAdminSelector current={selectedDevState ?? baseResolved.devState} />}
    </main>
  );
}

function resolveState({
  activeDevState,
  application,
  user,
  locale,
  fakeDate,
  t,
  shirt,
  canUseShirts,
  onboardingEnabled,
  officeGrant,
}: {
  activeDevState: DevState | null;
  application: { status: string; created_at: string } | null;
  user:
    | {
        ambassador_region: string | null;
        hca_country: string | null;
        country_name: string | null;
        country_code: string | null;
        manual_dashboard_state: string | null;
      }
    | null;
  locale: string;
  fakeDate: string;
  t: DashboardTranslations;
  shirt: ShirtOrderSectionProps;
  officeGrant: OfficeGrantRecord | null;
  canUseShirts: boolean;
  onboardingEnabled: boolean;
}): ResolvedState {
  const devFailedOfficeGrant: OfficeGrantRecord = {
    id: "dev-failed-office-grant",
    userId: "dev-user",
    grantId: null,
    organizationId: null,
    provisioningState: "pending",
    provisioningSource: "dev",
    purpose: "Dev office grant",
    amountCents: 0,
    balanceCents: null,
    balanceSyncedAt: null,
    linkedAt: null,
    linkedByUserId: null,
    lastAttemptedAt: fakeDate,
    nextRetryAt: null,
    lastError: "Dev state: grant provisioning failed.",
    createdAt: fakeDate,
    updatedAt: fakeDate,
  };
  const states = {
    ineligible: {
      node: (
        <StatusCard
          tone="primary"
          glyph="map-pin"
          title={t("dashboard.ineligible-region.title")}
          body={t("dashboard.ineligible-region.body")}
          action={{
            href: "/settings",
            label: t("dashboard.ineligible-region.cta"),
          }}
        />
      ),
      activeStep: "apply",
      decision: null,
      devState: "ineligible",
    },
    apply: {
      node: (
        <StatusCard
          tone="primary"
          glyph="idea"
          title={t("dashboard.no-application.title")}
          body={t("dashboard.no-application.body")}
          action={{
            href: "/apply",
            label: t("dashboard.no-application.cta"),
            external: true,
          }}
        />
      ),
      activeStep: "apply",
      decision: null,
      devState: "apply",
    },
    "pending-checks": {
      node: (
        <StatusCard
          tone="accent"
          glyph="private"
          title={t("dashboard.pending-automatic-checks.title")}
          body={
            <>
              {t("dashboard.pending-automatic-checks.body")}
              <strong className="mt-4 block font-bold">
                {t("dashboard.pending-automatic-checks.support")}
              </strong>
            </>
          }
          action={{
            href: "https://auth.hackclub.com",
            label: t("dashboard.pending-automatic-checks.cta"),
          }}
        />
      ),
      activeStep: "verify",
      decision: null,
      devState: "pending-checks",
    },
    approved: {
      node: (
        <ApprovedDashboardContent
          canUseShirts={canUseShirts}
          officeGrant={officeGrant}
          onboardingEnabled={onboardingEnabled}
          shirt={shirt}
          t={t}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "approved",
    },
    "accepted-not-onboarded": {
      node: (
        <ApprovedDashboardContent
          canUseShirts={canUseShirts}
          officeGrant={officeGrant}
          onboardingEnabled={onboardingEnabled}
          shirt={{
            ...shirt,
            requiresOnboarding: true,
            onboardingStatus: AMBASSADOR_ONBOARDING_STATUS.unsubmitted,
          }}
          t={t}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "accepted-not-onboarded",
    },
    "accepted-onboarding-submitted": {
      node: (
        <ApprovedDashboardContent
          canUseShirts={canUseShirts}
          officeGrant={officeGrant}
          onboardingEnabled={onboardingEnabled}
          shirt={{
            ...shirt,
            requiresOnboarding: true,
            onboardingStatus: AMBASSADOR_ONBOARDING_STATUS.submitted,
          }}
          t={t}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "accepted-onboarding-submitted",
    },
    "accepted-pending-signature": {
      node: (
        <ApprovedDashboardContent
          canUseShirts={canUseShirts}
          officeGrant={officeGrant}
          onboardingEnabled={onboardingEnabled}
          shirt={{
            ...shirt,
            requiresOnboarding: true,
            onboardingStatus: AMBASSADOR_ONBOARDING_STATUS.pendingSignature,
          }}
          t={t}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "accepted-pending-signature",
    },
    "accepted-onboarding-completed": {
      node: (
        <ApprovedDashboardContent
          canUseShirts={canUseShirts}
          officeGrant={officeGrant}
          onboardingEnabled={onboardingEnabled}
          shirt={{
            ...shirt,
            requiresOnboarding: true,
            onboardingStatus: AMBASSADOR_ONBOARDING_STATUS.completed,
          }}
          t={t}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "accepted-onboarding-completed",
    },
    "accepted-grant-failed": {
      node: (
        <ApprovedDashboardContent
          canUseShirts={canUseShirts}
          officeGrant={devFailedOfficeGrant}
          onboardingEnabled={onboardingEnabled}
          shirt={{ ...shirt, requiresOnboarding: false }}
          t={t}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "accepted-grant-failed",
    },
    rejected: {
      node: (
        <StatusCard
          tone="primary"
          glyph="idea"
          title={t("dashboard.rejected.title")}
          body={t("dashboard.rejected.body")}
          action={{
            href: "/apply",
            label: t("dashboard.rejected.cta"),
            external: true,
          }}
        />
      ),
      activeStep: "apply",
      decision: null,
      devState: "rejected",
    },
    banned: {
      node: (
        <StatusCard
          tone="rejection"
          glyph="forbidden"
          title={t("dashboard.rejected-permanently.title")}
          body={t("dashboard.rejected-permanently.body")}
        />
      ),
      activeStep: "decision",
      decision: "banned",
      devState: "banned",
    },
  } satisfies Record<Exclude<DevState, "pending">, ResolvedState>;

  switch (activeDevState) {
    case null:
      break;
    case "ineligible":
    case "pending-checks":
    case "approved":
    case "accepted-not-onboarded":
    case "accepted-onboarding-submitted":
    case "accepted-pending-signature":
    case "accepted-onboarding-completed":
    case "accepted-grant-failed":
    case "rejected":
    case "banned":
    case "apply":
      return states[activeDevState];
    case "pending":
      return {
        node: <PendingApplication createdAt={fakeDate} dateFormatLocale={locale} t={t} />,
        activeStep: "review",
        decision: null,
        devState: "pending",
      };
    default:
      break;
  }

  const resolvedRegion = resolveAmbassadorRegion(
    user?.ambassador_region ?? null,
    user?.hca_country ?? null,
    user?.country_name ?? null,
    user?.country_code ?? null,
  );
  const manualDashboardStateValue = user?.manual_dashboard_state ?? null;
  const manualDashboardState = isUserManualDashboardState(manualDashboardStateValue)
    ? manualDashboardStateValue
    : null;

  if (manualDashboardState === "approved") return states.approved;
  if (manualDashboardState === "rejected") return states.rejected;
  if (manualDashboardState === "banned") return states.banned;
  if (!application && resolvedRegion === "Other") return states.ineligible;
  if (!application) return states.apply;
  if (application.status === APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS) {
    return states["pending-checks"];
  }
  if (isPendingApplicationStatus(application.status)) {
    return {
      node: <PendingApplication createdAt={application.created_at} dateFormatLocale={locale} t={t} />,
      activeStep: "review",
      decision: null,
      devState: "pending",
    };
  }
  if (isAcceptedApplicationStatus(application.status)) return states.approved;
  if (isRejectedApplicationStatus(application.status)) return states.rejected;
  if (isRejectedPermanentlyApplicationStatus(application.status)) return states.banned;
  return { node: null, activeStep: null, decision: null, devState: "apply" };
}

function ApprovedDashboardContent({
  canUseShirts,
  officeGrant,
  onboardingEnabled,
  shirt,
  t,
}: {
  canUseShirts: boolean;
  officeGrant: OfficeGrantRecord | null;
  onboardingEnabled: boolean;
  shirt: ShirtOrderSectionProps;
  t: DashboardTranslations;
}) {
  return (
    <div className="space-y-8">
      <StatusCard
        tone="acceptance"
        glyph="checkbox-checked"
        title={t("dashboard.approved.title")}
        body={t("dashboard.approved.body")}
      />
      {shirt.requiresOnboarding ? (
        <OnboardingPromptBanner
          enabled={onboardingEnabled}
          status={shirt.onboardingStatus}
          onboardingFormUrl={shirt.onboardingFormUrl}
          t={t}
        />
      ) : (
        <>
          <OfficeGrantSection officeGrant={officeGrant} t={t} />
          {canUseShirts ? <ShirtOrderSection {...shirt} /> : null}
        </>
      )}
    </div>
  );
}

function OnboardingPromptBanner({
  enabled,
  status,
  onboardingFormUrl,
  t,
}: {
  enabled: boolean;
  status: string;
  onboardingFormUrl: string;
  t: DashboardTranslations;
}) {
  if (status !== AMBASSADOR_ONBOARDING_STATUS.unsubmitted) {
    const statusKey = getOnboardingStatusMessageKey(status);

    return (
      <section className="border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4">
        <p className="font-body text-sm leading-relaxed text-white">
          <span className="font-bold text-[var(--primary)]">
            {t(`dashboard.onboarding.status.${statusKey}.title`)}
          </span>{" "}
          {t(`dashboard.onboarding.status.${statusKey}.body`)}
        </p>
      </section>
    );
  }

  if (!enabled) {
    return (
      <section className="border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4">
        <p className="font-body text-sm leading-relaxed text-white">
          <span className="font-bold text-[var(--primary)]">
            {t("dashboard.onboarding.disabled-title")}
          </span>{" "}
          {t("dashboard.onboarding.disabled-body")}
        </p>
      </section>
    );
  }

  return (
    <section className="border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4">
      <p className="font-body text-sm leading-relaxed text-white">
        <span className="font-bold text-[var(--primary)]">
          {t("dashboard.onboarding.title")}
        </span>{" "}
        {t("dashboard.onboarding.body")}{" "}
        <a
          href={onboardingFormUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={t("dashboard.onboarding.cta")}
          className="ui-open-link ml-1 inline-flex"
        >
          ↗
        </a>
      </p>
    </section>
  );
}

function getOnboardingStatusMessageKey(status: string) {
  if (status === AMBASSADOR_ONBOARDING_STATUS.submitted) return "submitted";
  if (status === AMBASSADOR_ONBOARDING_STATUS.pendingSignature) return "pending-signature";
  if (status === AMBASSADOR_ONBOARDING_STATUS.completed) return "completed";

  throw new Error(`No dashboard onboarding message configured for Airtable status: ${status}`);
}

function OfficeGrantSection({
  officeGrant,
  t,
}: {
  officeGrant: OfficeGrantRecord | null;
  t: DashboardTranslations;
}) {
  const message = getOfficeGrantDashboardMessage({ grant: officeGrant });

  return (
    <section>
      <div className="min-w-0">
        <h2 className="font-sub text-2xl text-white md:text-3xl">{t("office-grant.title")}</h2>

        <p className="mt-2 text-base leading-relaxed text-muted-foreground md:text-lg">
          {message.messageKey === "linked" && message.href !== null ? (
            <>
              {t("office-grant.messages.linked-open-label")}{" "}
              <a
                href={message.href}
                target="_blank"
                rel="noreferrer"
                className="ui-open-link ml-1 inline-flex font-body text-lg leading-none"
                aria-label={t("office-grant.messages.linked-open-aria")}
              >
                <span aria-hidden="true">↗</span>
              </a>
            </>
          ) : (
            t(`office-grant.messages.${message.messageKey}`)
          )}
        </p>
      </div>
    </section>
  );
}

function JourneyStepper({
  activeStep,
  decision,
  t,
}: {
  activeStep: StepKey;
  decision: Decision;
  t: DashboardTranslations;
}) {
  const steps: StepKey[] = ["apply", "verify", "review", "decision"];
  const activeIdx = steps.indexOf(activeStep);
  const progressRatio = Math.max(0, activeIdx) / (steps.length - 1);

  return (
    <div className="relative">
      <span aria-hidden className="absolute left-5 right-5 top-5 h-px bg-foreground/15" />
      <span
        aria-hidden
        className="absolute left-5 top-5 h-px bg-foreground"
        style={{ width: `calc((100% - 2.5rem) * ${progressRatio})` }}
      />
      <ol className="relative flex items-start justify-between gap-3">
        {steps.map((key, i) => {
          const isActive = i === activeIdx;
          const isComplete = i < activeIdx;
          const isDecisionStep = key === "decision";

          const decisionTone: Tone | null =
            isDecisionStep && decision === "approved"
              ? "acceptance"
              : isDecisionStep && (decision === "rejected" || decision === "banned")
                ? "rejection"
                : null;

          const activeTone: Tone = decisionTone ?? "primary";

          const circleClass = isActive
            ? cn(
                "text-white border-transparent",
                activeTone === "acceptance" ? "bg-acceptance" : "bg-primary",
              )
            : isComplete
              ? "bg-foreground text-background border-foreground"
              : "border-foreground/15 bg-background text-muted-foreground";

          const labelClass = isActive
            ? cn(
                "font-bold",
                activeTone === "acceptance" ? "text-acceptance" : "text-primary",
              )
            : isComplete
              ? "text-foreground"
              : "text-muted-foreground";

          return (
            <li key={key} className="flex min-w-10 flex-col items-center gap-2">
              <span
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold leading-none",
                  circleClass,
                )}
              >
                {isComplete ? (
                  <span
                    aria-hidden
                    className="block h-3 w-2 -translate-y-px rotate-45 border-b-2 border-r-2 border-current"
                  />
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn("text-center text-xs", labelClass)}>
                {t(`dashboard.stepper.${key}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type StatusCardProps = {
  tone: Tone;
  glyph: IconGlyph;
  title: string;
  body: ReactNode;
  action?: {
    href: string;
    label: string;
    external?: boolean;
  };
};

function StatusCard({
  tone,
  glyph,
  title,
  body,
  action,
}: StatusCardProps) {
  return (
    <section>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="font-sub text-2xl text-white md:text-3xl">{title}</h2>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center",
              tone === "accent"
                ? "text-accent"
                : tone === "acceptance"
                  ? "text-acceptance"
                  : "text-primary",
            )}
            aria-hidden
          >
            <Icon glyph={glyph} size={28} />
          </span>
        </div>

        <p className="mt-2 text-base leading-relaxed text-muted-foreground md:text-lg">
          {body}
        </p>

        {action ? (
          <a
            href={action.href}
            className={cn(buttonVariants({ size: "app" }), "mt-5")}
            target={action.external === true ? "_blank" : undefined}
            rel={action.external === true ? "noreferrer" : undefined}
          >
            {action.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function PendingApplication({
  createdAt,
  dateFormatLocale,
  t,
}: {
  createdAt: string;
  dateFormatLocale: string;
  t: DashboardTranslations;
}) {
  const submittedDate = new Date(createdAt).toLocaleDateString(dateFormatLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <StatusCard
      tone="accent"
      glyph="clock"
      title={t("dashboard.pending.title")}
      body={t("dashboard.pending.body", { date: submittedDate })}
    />
  );
}

function AmbassadorCircleText({
  className,
  slackId,
  fallbackName,
}: {
  className?: string;
  slackId?: string;
  fallbackName?: string;
}) {
  const textPathId = useId();
  const ringText = "Ambassador • Ambassador • ";
  const ringCircumference = 2 * Math.PI * 40;
  const trimmedFallbackName = fallbackName?.trim() ?? "";
  const initial = trimmedFallbackName !== "" ? trimmedFallbackName.charAt(0).toUpperCase() : "?";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      aria-label="Ambassadors"
    >
      <span className="sr-only">Ambassadors</span>
      <svg aria-hidden viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <defs>
          <path id={textPathId} d="M 50,50 m 0,-40 a 40,40 0 1,1 0,80 a 40,40 0 1,1 0,-80" />
        </defs>
        <text fill="currentColor" xmlSpace="preserve" className="text-[17px] font-bold text-foreground">
          <textPath
            href={`#${textPathId}`}
            startOffset="0%"
            textLength={ringCircumference}
            lengthAdjust="spacing"
          >
            {ringText}
          </textPath>
        </text>
      </svg>
      <div className="absolute top-1/2 left-1/2 aspect-square w-[64%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full">
        {slackId !== undefined && slackId !== "" ? (
          <div
            aria-hidden
            className="h-full w-full rounded-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("https://cachet.dunkirk.sh/users/${slackId}/r")` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white font-body text-sm text-black">
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
