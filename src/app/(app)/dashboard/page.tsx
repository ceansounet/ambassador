import Icon from "@hackclub/icons";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { useId, type ComponentProps, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { DevAdminSelector } from "@/components/dev-admin-selector";
import { Navbar } from "@/components/navbar";
import { buttonVariants } from "@/components/ui/button";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { getAmbassadorOnboardingStatus } from "@/lib/ambassadors/airtable";
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
import { loadUserHackClubAddresses } from "@/lib/hca-addresses";
import { readHcaAccessToken } from "@/lib/hca-access-token";
import { canAccessPosters } from "@/lib/posters/access";
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

const AMBASSADOR_ONBOARDING_FORM_URL = "https://forms.hackclub.com/t/mJvXsYY41Lus";

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

const toneText: Record<Tone, string> = {
  primary: "text-primary",
  accent: "text-accent",
  acceptance: "text-acceptance",
  rejection: "text-primary",
};
const toneBg: Record<Tone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  acceptance: "bg-acceptance",
  rejection: "bg-primary",
};

const APPLY_PATH = "/apply";
const STEP_ORDER: StepKey[] = ["apply", "verify", "review", "decision"];

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
  const [t, locale, { devState }] = await Promise.all([
    getTranslations(),
    getLocale(),
    searchParams,
  ]);

  const [[application], [user], [existingOrderRow]] = await Promise.all([
    sql<ApplicationRow[]>`
      SELECT id, status, name, created_at, airtable_record_id, airtable_payload
      FROM applications WHERE user_id = ${session.sub}
      ORDER BY created_at DESC LIMIT 1
    `,
    sql<UserRow[]>`
      SELECT balance_cents, is_admin, ambassador_region, hca_country, country_name, country_code,
             hca_addresses, hca_access_token, manual_dashboard_state
      FROM users WHERE id = ${session.sub}
    `,
    sql<ShirtOrderRow[]>`
      SELECT id, status, variant, warehouse_order_id, warehouse_payload, note
      FROM orders
      WHERE user_id = ${session.sub} AND sku LIKE ${`${SHIRT_SKU_PREFIX}%`}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
  ]);

  const canUseShirts = canAccessShirts({
    latestApplicationStatus: application?.status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
  });
  const shirtOnboardingStatus = canUseShirts
    ? await getAmbassadorOnboardingStatus({
        applicationAirtableRecordId: application?.airtable_record_id ?? null,
        applicationAirtablePayload: application?.airtable_payload ?? null,
      })
    : { hasAmbassadorRecord: false, onboardingComplete: false };
  const shirtRequiresOnboarding =
    canUseShirts &&
    (!shirtOnboardingStatus.hasAmbassadorRecord ||
      !shirtOnboardingStatus.onboardingComplete);
  const shouldLoadShirtAddresses = canUseShirts && !shirtRequiresOnboarding;
  let shirtNeedsAddressRefresh = false;
  let shirtAddresses: HackClubAddress[] = [];
  const hcaAccessToken = readHcaAccessToken(user?.hca_access_token ?? null);

  if (shouldLoadShirtAddresses) {
    const addressState = await loadUserHackClubAddresses({
      userId: session.sub,
      storedAddresses: user?.hca_addresses ?? [],
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
        warehouseUrl: warehouseOrderId ? buildWarehouseTrackingUrl(warehouseOrderId) : null,
        publicOrderUrl: warehouseOrderId
          ? buildWarehousePublicOrderUrl(warehouseOrderId)
          : null,
        note: existingOrderRow.note,
      }
    : null;
  const shirt: ShirtOrderSectionProps = {
    addresses: shirtAddresses,
    needsAddressRefresh: shirtNeedsAddressRefresh,
    existingOrder: shirtExistingOrder,
    requiresOnboarding: shirtRequiresOnboarding,
    onboardingFormUrl: AMBASSADOR_ONBOARDING_FORM_URL,
  };

  const canAccessAdmin = Boolean(session.impersonator) || Boolean(user?.is_admin ?? session.isAdmin);
  const canUseSelector = canShowDevAdminSelector(canAccessAdmin);
  const fakeDate = new Date().toISOString();
  const stateInput = { application, user, locale, fakeDate, t, shirt, canUseShirts };
  const baseResolved = resolveState({ ...stateInput, activeDevState: null });
  const selectedDevState = devState && isDevState(devState) ? devState : null;
  const resolved = canUseSelector && selectedDevState
    ? resolveState({ ...stateInput, activeDevState: selectedDevState })
    : baseResolved;
  const devSwitcherCurrent = selectedDevState ?? baseResolved.devState;
  const showAmbassadorRing = resolved.decision === "approved";
  const showPostersLink = canAccessPosters({
    latestApplicationStatus: application?.status ?? null,
    manualDashboardState: user?.manual_dashboard_state ?? null,
  });

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={user?.balance_cents ?? 0}
        showPostersLink={showPostersLink}
      />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="flex items-center gap-2 md:gap-3">
          <h1 className="font-sub text-4xl leading-none text-white md:text-5xl">
            {t("dashboard.heading", { name: session.displayName })}
          </h1>
          {showAmbassadorRing ? (
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
      {canUseSelector && <DevAdminSelector current={devSwitcherCurrent} />}
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
}: {
  activeDevState: DevState | null;
  application: { status: string; created_at: string } | undefined;
  user:
    | {
        ambassador_region?: string | null;
        hca_country?: string | null;
        country_name?: string | null;
        country_code?: string | null;
        manual_dashboard_state?: string | null;
      }
    | undefined;
  locale: string;
  fakeDate: string;
  t: DashboardTranslations;
  shirt: ShirtOrderSectionProps;
  canUseShirts: boolean;
}): ResolvedState {
  const states = {
    ineligible: {
      node: <IneligibleRegion t={t} />,
      activeStep: "apply",
      decision: null,
      devState: "ineligible",
    },
    apply: {
      node: <NoApplication t={t} />,
      activeStep: "apply",
      decision: null,
      devState: "apply",
    },
    "pending-checks": {
      node: <PendingAutomaticChecksApplication t={t} />,
      activeStep: "verify",
      decision: null,
      devState: "pending-checks",
    },
    approved: {
      node: (
        <ApprovedApplication
          t={t}
          shirt={shirt}
          canShowShirtSection={canUseShirts}
        />
      ),
      activeStep: "decision",
      decision: "approved",
      devState: "approved",
    },
    rejected: {
      node: <RejectedApplication t={t} />,
      activeStep: "apply",
      decision: null,
      devState: "rejected",
    },
    banned: {
      node: <RejectedPermanentlyApplication t={t} />,
      activeStep: "decision",
      decision: "banned",
      devState: "banned",
    },
  } satisfies Record<Exclude<DevState, "pending">, ResolvedState>;

  switch (activeDevState) {
    case "ineligible":
    case "pending-checks":
    case "approved":
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

function JourneyStepper({
  activeStep,
  decision,
  t,
}: {
  activeStep: StepKey;
  decision: Decision;
  t: DashboardTranslations;
}) {
  const activeIdx = STEP_ORDER.indexOf(activeStep);
  const progressRatio = Math.max(0, activeIdx) / (STEP_ORDER.length - 1);

  return (
    <div className="relative">
      <span aria-hidden className="absolute left-5 right-5 top-5 h-px bg-foreground/15" />
      <span
        aria-hidden
        className="absolute left-5 top-5 h-px bg-foreground"
        style={{ width: `calc((100% - 2.5rem) * ${progressRatio})` }}
      />
      <ol className="relative flex items-start justify-between gap-3">
        {STEP_ORDER.map((key, i) => {
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
            ? cn("text-white border-transparent", toneBg[activeTone])
            : isComplete
              ? "bg-foreground text-background border-foreground"
              : "border-foreground/15 bg-background text-muted-foreground";

          const labelClass = isActive
            ? cn("font-bold", toneText[activeTone])
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
                <StepperSymbol isComplete={isComplete} stepNumber={i + 1} />
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

function StepperSymbol({ isComplete, stepNumber }: { isComplete: boolean; stepNumber: number }) {
  if (isComplete) {
    return (
      <span
        aria-hidden
        className="block h-3 w-2 -translate-y-px rotate-45 border-b-2 border-r-2 border-current"
      />
    );
  }

  return <>{stepNumber}</>;
}

type StatusCardProps = {
  tone: Tone;
  glyph: IconGlyph;
  title: string;
  body: string;
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
              toneText[tone],
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
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noreferrer" : undefined}
          >
            {action.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function IneligibleRegion({ t }: { t: DashboardTranslations }) {
  return (
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
  );
}

function NoApplication({ t }: { t: DashboardTranslations }) {
  return (
    <StatusCard
      tone="primary"
      glyph="idea"
      title={t("dashboard.no-application.title")}
      body={t("dashboard.no-application.body")}
      action={{
        href: APPLY_PATH,
        label: t("dashboard.no-application.cta"),
        external: true,
      }}
    />
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

function PendingAutomaticChecksApplication({ t }: { t: DashboardTranslations }) {
  return (
    <StatusCard
      tone="accent"
      glyph="private"
      title={t("dashboard.pending-automatic-checks.title")}
      body={t("dashboard.pending-automatic-checks.body")}
      action={{
        href: "https://auth.hackclub.com",
        label: t("dashboard.pending-automatic-checks.cta"),
      }}
    />
  );
}

function ApprovedApplication({
  t,
  shirt,
  canShowShirtSection,
}: {
  t: DashboardTranslations;
  shirt: ShirtOrderSectionProps;
  canShowShirtSection: boolean;
}) {
  return (
    <div className="space-y-8">
      <StatusCard
        tone="acceptance"
        glyph="checkbox-checked"
        title={t("dashboard.approved.title")}
        body={t("dashboard.approved.body")}
      />
      {canShowShirtSection ? <ShirtOrderSection {...shirt} /> : null}
    </div>
  );
}

function RejectedApplication({ t }: { t: DashboardTranslations }) {
  return (
    <StatusCard
      tone="primary"
      glyph="idea"
      title={t("dashboard.rejected.title")}
      body={t("dashboard.rejected.body")}
      action={{
        href: APPLY_PATH,
        label: t("dashboard.rejected.cta"),
        external: true,
      }}
    />
  );
}

function RejectedPermanentlyApplication({ t }: { t: DashboardTranslations }) {
  return (
    <StatusCard
      tone="rejection"
      glyph="forbidden"
      title={t("dashboard.rejected-permanently.title")}
      body={t("dashboard.rejected-permanently.body")}
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
  const initial = fallbackName?.trim().charAt(0).toUpperCase() || "?";

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
        {slackId ? (
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
