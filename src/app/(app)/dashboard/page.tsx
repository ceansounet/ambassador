import Icon from "@hackclub/icons";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { useId, type ComponentProps, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { fetchHackClubAddresses } from "@/lib/auth";
import { DevAdminSelector } from "@/components/dev-admin-selector";
import { Navbar } from "@/components/navbar";
import { buttonVariants } from "@/components/ui/button";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import {
  APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS,
  isAcceptedApplicationStatus,
  isPendingApplicationStatus,
  isRejectedApplicationStatus,
  isRejectedPermanentlyApplicationStatus,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { canShowDevAdminSelector, isDevelopmentEnvironment, isDevState, type DevState } from "@/lib/dev-admin-selector";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSession } from "@/lib/session";
import {
  isCompleteHackClubAddress,
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

import ShirtOrderSection, {
  type ShirtOrderSectionProps,
  type ShirtOrderState,
} from "./shirt-order";

type DashboardTranslations = (key: string, values?: Record<string, number | string>) => string;
type IconGlyph = NonNullable<ComponentProps<typeof Icon>["glyph"]>;
type Tone = "primary" | "accent" | "acceptance" | "rejection";
type StepKey = "apply" | "verify" | "review" | "decision";
type Decision = "approved" | "rejected" | "banned" | null;

const toneText: Record<Tone, string> = {
  primary: "text-primary",
  accent: "text-accent",
  acceptance: "text-acceptance",
  rejection: "text-rejection",
};
const toneBg: Record<Tone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  acceptance: "bg-acceptance",
  rejection: "bg-rejection",
};

const STEP_ORDER: StepKey[] = ["apply", "verify", "review", "decision"];

type ShirtOrderRow = {
  id: string;
  status: string;
  variant: string | null;
  warehouse_order_id: string | null;
  note: string | null;
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
    sql`
      SELECT id, status, name, created_at
      FROM applications WHERE user_id = ${session.sub}
      ORDER BY created_at DESC LIMIT 1
    `,
    sql`
      SELECT balance_cents, is_admin, ambassador_region, country_name,
             shirt_enabled, hca_access_token, manual_dashboard_state
      FROM users WHERE id = ${session.sub}
    `,
    sql<ShirtOrderRow[]>`
      SELECT id, status, variant, warehouse_order_id, note
      FROM orders
      WHERE user_id = ${session.sub} AND sku LIKE ${`${SHIRT_SKU_PREFIX}%`}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
  ]);

  const shouldLoadShirtAddresses =
    Boolean((user as { shirt_enabled?: boolean | null } | undefined)?.shirt_enabled) &&
    Boolean(application && isAcceptedApplicationStatus(application.status));
  let shirtNeedsAddressRefresh = false;
  let shirtAddresses: HackClubAddress[] = [];

  if (shouldLoadShirtAddresses) {
    const hcaAccessToken = (user as { hca_access_token?: string | null } | undefined)
      ?.hca_access_token;

    if (!hcaAccessToken) {
      shirtNeedsAddressRefresh = true;
    } else {
      shirtAddresses = await fetchHackClubAddresses(hcaAccessToken).catch((error) => {
        console.error("Failed to load live Hack Club Auth addresses", {
          userId: session.sub,
          error,
        });
        shirtNeedsAddressRefresh = true;
        return [];
      });
      shirtAddresses = shirtAddresses.filter(isCompleteHackClubAddress);
    }
  }
  const shirtExistingOrder: ShirtOrderState | null = existingOrderRow
    ? {
        id: existingOrderRow.id,
        status: existingOrderRow.status,
        size: existingOrderRow.variant,
        warehouseUrl: existingOrderRow.warehouse_order_id
          ? buildWarehouseTrackingUrl(existingOrderRow.warehouse_order_id)
          : null,
        publicOrderUrl: existingOrderRow.warehouse_order_id
          ? buildWarehousePublicOrderUrl(existingOrderRow.warehouse_order_id)
          : null,
        note: existingOrderRow.note,
      }
    : null;
  const shirt: ShirtOrderSectionProps = {
    shirtEnabled: Boolean(
      (user as { shirt_enabled?: boolean | null } | undefined)?.shirt_enabled,
    ),
    addresses: shirtAddresses,
    needsAddressRefresh: shirtNeedsAddressRefresh,
    existingOrder: shirtExistingOrder,
  };

  const fakeDate = new Date().toISOString();
  const baseResolved = resolveState({
    activeDevState: null,
    application: application as { status: string; created_at: string } | undefined,
    user: user as
      | {
          ambassador_region?: string | null;
          country_name?: string | null;
          manual_dashboard_state?: string | null;
        }
      | undefined,
    locale,
    fakeDate,
    t,
    shirt,
  });
  const selectedDevState = normalizeDevState(devState);
  const resolved = isDevelopmentEnvironment && selectedDevState
    ? resolveState({
        activeDevState: selectedDevState,
        application: application as { status: string; created_at: string } | undefined,
        user: user as
          | {
              ambassador_region?: string | null;
              country_name?: string | null;
              manual_dashboard_state?: string | null;
            }
          | undefined,
        locale,
        fakeDate,
        t,
        shirt,
      })
    : baseResolved;
  const canUseSelector = canShowDevAdminSelector(Boolean(user?.is_admin ?? session.isAdmin));
  const devSwitcherCurrent = selectedDevState ?? baseResolved.devState;
  const showAmbassadorRing = resolved.decision === "approved";

  return (
    <main className="page-shell">
      <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="flex items-center gap-2 md:gap-3">
          <h1 className="font-sub text-4xl leading-none text-white md:text-5xl">
            {t("dashboard.heading", { name: session.displayName })}
          </h1>
          {showAmbassadorRing ? (
            <AmbassadorCircleText className="h-14 w-14 shrink-0 md:h-16 md:w-16" />
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
}: {
  activeDevState: DevState | null;
  application: { status: string; created_at: string } | undefined;
  user:
    | {
        ambassador_region?: string | null;
        country_name?: string | null;
        manual_dashboard_state?: string | null;
      }
    | undefined;
  locale: string;
  fakeDate: string;
  t: DashboardTranslations;
  shirt: ShirtOrderSectionProps;
}): { node: ReactNode; activeStep: StepKey | null; decision: Decision; devState: DevState } {
  const ineligible = { node: <IneligibleRegion t={t} />, activeStep: "apply" as const, decision: null, devState: "ineligible" as const };
  const apply = { node: <NoApplication t={t} />, activeStep: "apply" as const, decision: null, devState: "apply" as const };
  const verify = {
    node: <PendingAutomaticChecksApplication t={t} />,
    activeStep: "verify" as const,
    decision: null,
    devState: "pending-checks" as const,
  };
  const pending = (createdAt: string) => ({
    node: <PendingApplication createdAt={createdAt} dateFormatLocale={locale} t={t} />,
    activeStep: "review" as const,
    decision: null,
    devState: "pending" as const,
  });
  const approved = {
    node: <ApprovedApplication t={t} shirt={shirt} />,
    activeStep: "decision" as const,
    decision: "approved" as const,
    devState: "approved" as const,
  };
  const rejected = { node: <RejectedApplication t={t} />, activeStep: "apply" as const, decision: null, devState: "rejected" as const };
  const banned = {
    node: <RejectedPermanentlyApplication t={t} />,
    activeStep: "decision" as const,
    decision: "banned" as const,
    devState: "banned" as const,
  };

  if (activeDevState === "ineligible") return ineligible;
  if (activeDevState === "pending-checks") return verify;
  if (activeDevState === "pending") return pending(fakeDate);
  if (activeDevState === "approved") return approved;
  if (activeDevState === "rejected") return rejected;
  if (activeDevState === "banned") return banned;
  if (activeDevState === "apply") return apply;

  const resolvedRegion = resolveAmbassadorRegion(
    user?.ambassador_region ?? null,
    user?.country_name ?? null,
  );
  const manualDashboardStateValue = user?.manual_dashboard_state ?? null;
  const manualDashboardState = isUserManualDashboardState(manualDashboardStateValue)
    ? manualDashboardStateValue
    : null;

  if (!application && manualDashboardState === "approved") return approved;
  if (!application && manualDashboardState === "rejected") return rejected;
  if (!application && manualDashboardState === "banned") return banned;
  if (!application && resolvedRegion === "Other") return ineligible;
  if (!application) return apply;
  if (application.status === APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS) return verify;
  if (isPendingApplicationStatus(application.status)) return pending(application.created_at);
  if (isAcceptedApplicationStatus(application.status)) return approved;
  if (isRejectedApplicationStatus(application.status)) return rejected;
  if (isRejectedPermanentlyApplicationStatus(application.status)) return banned;
  return { node: null, activeStep: null, decision: null, devState: "apply" };
}

function normalizeDevState(value: string | DevState | undefined): DevState | null {
  if (!value) return null;
  return isDevState(value) ? value : null;
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
        href: "/form",
        label: t("dashboard.no-application.cta"),
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
}: {
  t: DashboardTranslations;
  shirt: ShirtOrderSectionProps;
}) {
  return (
    <div className="space-y-8">
      <StatusCard
        tone="acceptance"
        glyph="checkbox-checked"
        title={t("dashboard.approved.title")}
        body={t("dashboard.approved.body")}
      />
      <ShirtOrderSection {...shirt} />
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
        href: "/form",
        label: t("dashboard.rejected.cta"),
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

function AmbassadorCircleText({ className }: { className?: string }) {
  const textPathId = useId();
  const ringText = "Ambassador • Ambassador • ";
  const ringCircumference = 2 * Math.PI * 40;

  return (
    <div className={cn("inline-flex items-center justify-center", className)} aria-label="Ambassadors">
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
    </div>
  );
}
