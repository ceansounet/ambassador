"use client";

import Icon from "@hackclub/icons";
import { InfoIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartTooltip,
  DashboardResponsiveChart,
  getBarChartAxisMax,
  type DashboardTopAmbassadorPoint,
} from "@/components/admin/dashboard-chart-primitives";
import { MultiSelect, SingleSelect } from "@/components/admin/dashboard-selects";
import { TopAmbassadorsChart } from "@/components/admin/top-ambassadors-chart";
import { ambassadorRegionFlag } from "@/lib/settings";

export type RegionCount = { region: string; count: number };

export type PriorityActivityPoint = {
  label: string;
  referrals: number;
  referralsUS: number;
  posters: number;
  postersUS: number;
  completed: number;
  completedUS: number;
  hoursLogged: number;
  hoursLoggedUS: number;
  hoursApproved: number;
  hoursApprovedUS: number;
};

type Scope = "all" | "us" | "other";
type ActivityRange = 7 | 14 | 30 | 90 | "all";
type ActivityMetric = "referrals" | "posters" | "completed" | "hoursLogged" | "hoursApproved";

const ACTIVITY_RANGES: ActivityRange[] = [7, 14, 30, 90, "all"];
const ACTIVITY_METRICS: ActivityMetric[] = [
  "referrals",
  "posters",
  "completed",
  "hoursLogged",
  "hoursApproved",
];

const REGION_BAR_PALETTE = [
  "var(--chart-signups)",
  "var(--chart-approved)",
  "var(--chart-applications)",
  "var(--chart-rejected)",
  "var(--chart-visits)",
  "var(--chart-pending)",
  "var(--chart-banned)",
];

// One weighted grant = 10 approved Stardance hours, worth $8.50.
const WEIGHTED_GRANT_HOURS = 10;
const WEIGHTED_GRANT_RATE = 8.5;

const METRIC_STROKE: Record<ActivityMetric, string> = {
  referrals: "var(--chart-rejected)",
  posters: "var(--chart-approved)",
  completed: "var(--chart-signups)",
  hoursLogged: "var(--chart-applications)",
  hoursApproved: "var(--chart-visits)",
};

type CostCentsKey = Exclude<keyof CostReady, "status">;

const COST_BUCKETS: { key: string; total: CostCentsKey; us: CostCentsKey | null; fill: string }[] = [
  { key: "referrals", total: "referralCents", us: "referralCentsUS", fill: "var(--chart-rejected)" },
  { key: "posters", total: "posterCents", us: "posterCentsUS", fill: "var(--chart-approved)" },
  { key: "shirts", total: "shirtCents", us: "shirtCentsUS", fill: "var(--chart-applications)" },
  { key: "admin", total: "adminCents", us: "adminCentsUS", fill: "var(--chart-pending)" },
  { key: "grants", total: "grantCents", us: "grantCentsUS", fill: "var(--chart-visits)" },
  { key: "reimbursements", total: "reimbursementCents", us: null, fill: "var(--chart-banned)" },
];

type CostReady = {
  status: "ready";
  totalCents: number;
  totalCentsUS: number;
  posterCents: number;
  posterCentsUS: number;
  referralCents: number;
  referralCentsUS: number;
  shirtCents: number;
  shirtCentsUS: number;
  adminCents: number;
  adminCentsUS: number;
  grantCents: number;
  grantCentsUS: number;
  reimbursementCents: number;
};
type CostState = { status: "loading" } | { status: "error" } | CostReady;

const COST_NUMERIC_KEYS = [
  "totalCents", "totalCentsUS", "posterCents", "posterCentsUS",
  "referralCents", "referralCentsUS", "shirtCents", "shirtCentsUS",
  "adminCents", "adminCentsUS", "grantCents", "grantCentsUS", "reimbursementCents",
] as const;

function parseCostResponse(value: unknown): CostReady | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  for (const key of COST_NUMERIC_KEYS) {
    if (typeof Reflect.get(value, key) !== "number") {
      return null;
    }
  }
  return { status: "ready", ...(value as Record<(typeof COST_NUMERIC_KEYS)[number], number>) };
}

export function PriorityDashboard({
  locale,
  activeAmbassadors,
  signupsDriven,
  hoursUsers,
  signupsByRegion,
  signupsByState,
  activityData,
  topAmbassadorsData,
}: {
  locale: string;
  activeAmbassadors: { activeTotal: number; activeUs: number; approvedTotal: number; approvedUs: number };
  signupsDriven: { total: number; us: number; completedTotal: number; completedUS: number };
  hoursUsers: { loggedTotal: number; loggedUs: number; approvedTotal: number; approvedUs: number };
  signupsByRegion: RegionCount[];
  signupsByState: RegionCount[];
  activityData: PriorityActivityPoint[];
  topAmbassadorsData: DashboardTopAmbassadorPoint[];
}) {
  const t = useTranslations("admin.overview.priority");
  const tc = useTranslations("admin.overview.charts");
  const [scope, setScope] = useState<Scope>("us");
  const [activityRange, setActivityRange] = useState<ActivityRange>(14);
  const [activityMetrics, setActivityMetrics] = useState<Set<ActivityMetric>>(
    () => new Set<ActivityMetric>(["referrals"]),
  );
  const [stateSearch, setStateSearch] = useState("");
  const [cost, setCost] = useState<CostState>({ status: "loading" });

  const numberFormatter = new Intl.NumberFormat(locale);
  const hoursFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const rateFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCost() {
      try {
        const response = await fetch("/api/admin/cost-summary", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setCost({ status: "error" });
          return;
        }
        const parsed = parseCostResponse((await response.json()) as unknown);
        if (!cancelled) setCost(parsed ?? { status: "error" });
      } catch {
        if (!cancelled) setCost({ status: "error" });
      }
    }

    void loadCost();

    return () => {
      cancelled = true;
    };
  }, []);

  // "us" = the US slice; "all" = everything; "other" = everything minus US.
  const scoped = (total: number, us: number) =>
    scope === "us" ? us : scope === "all" ? total : total - us;
  // The leaderboard follows the page scope (no separate region picker).
  const topRegion = scope === "us" ? "United States" : scope === "other" ? "non-us" : "all";

  const ambassadorsValue = scoped(activeAmbassadors.activeTotal, activeAmbassadors.activeUs);
  const approvedValue = scoped(activeAmbassadors.approvedTotal, activeAmbassadors.approvedUs);
  const signupsValue = scoped(signupsDriven.total, signupsDriven.us);
  const completedValue = scoped(signupsDriven.completedTotal, signupsDriven.completedUS);
  const totalCents =
    cost.status === "ready" ? scoped(cost.totalCents, cost.totalCentsUS) : null;

  // All-time hour totals (for the efficiency ratios), resolved to the scope.
  const { totalHoursLogged, totalHoursApproved } = useMemo(() => {
    let logged = 0;
    let approved = 0;
    for (const point of activityData) {
      logged += scope === "us" ? point.hoursLoggedUS : scope === "all" ? point.hoursLogged : point.hoursLogged - point.hoursLoggedUS;
      approved += scope === "us" ? point.hoursApprovedUS : scope === "all" ? point.hoursApproved : point.hoursApproved - point.hoursApprovedUS;
    }
    return { totalHoursLogged: logged, totalHoursApproved: approved };
  }, [activityData, scope]);

  const perSuccessfulReferral =
    totalCents !== null && completedValue > 0 ? totalCents / 100 / completedValue : null;
  const perHourShipped =
    totalCents !== null && totalHoursLogged > 0 ? totalCents / 100 / totalHoursLogged : null;

  const loggedUsers = scoped(hoursUsers.loggedTotal, hoursUsers.loggedUs);
  const approvedUsers = scoped(hoursUsers.approvedTotal, hoursUsers.approvedUs);
  const weightedGrants = totalHoursApproved / WEIGHTED_GRANT_HOURS;
  const weightedGrantDollars = weightedGrants * WEIGHTED_GRANT_RATE;

  // Cost buckets resolved to the scope; reimbursements aren't attributable to a
  // region so they sit in the all-regions and non-US totals, never the US one.
  const costBuckets =
    cost.status === "ready"
      ? COST_BUCKETS.map((bucket) => {
          const total = cost[bucket.total];
          const us = bucket.us === null ? 0 : cost[bucket.us];
          return { key: bucket.key, label: t(`cost-buckets.${bucket.key}`), cents: scoped(total, us), fill: bucket.fill };
        }).filter((bucket) => bucket.cents > 0)
      : [];
  const costPieData = costBuckets
    .map((bucket) => ({ label: bucket.label, value: bucket.cents / 100, fill: bucket.fill }))
    .sort((a, b) => b.value - a.value);
  const hasCostBreakdown = costPieData.length > 0;

  // Geographic breakdown: US drills into states (with a search box); the other
  // scopes show regions with flags (the non-US scope drops the US bar).
  const usingStates = scope === "us";
  const regionSource =
    scope === "other" ? signupsByRegion.filter((r) => r.region !== "United States") : signupsByRegion;
  const breakdownSource = usingStates ? signupsByState : regionSource;
  const filteredBreakdown = useMemo(() => {
    if (!usingStates || stateSearch.trim() === "") {
      return breakdownSource;
    }
    const needle = stateSearch.trim().toLowerCase();
    return breakdownSource.filter((entry) => entry.region.toLowerCase().includes(needle));
  }, [breakdownSource, usingStates, stateSearch]);
  const breakdownBarData = useMemo(
    () =>
      filteredBreakdown.map((entry, index) => ({
        label: usingStates ? entry.region : `${ambassadorRegionFlag(entry.region)}  ${entry.region}`,
        value: entry.count,
        fill: REGION_BAR_PALETTE[index % REGION_BAR_PALETTE.length],
      })),
    [filteredBreakdown, usingStates],
  );
  const hasBreakdownData = breakdownBarData.some((entry) => entry.value > 0);
  const breakdownHeight = Math.max(320, breakdownBarData.length * 34);
  const breakdownTitle = usingStates ? t("signups-by-state-title") : t("signups-by-region-title");

  const activitySeries = useMemo(() => {
    const windowed = activityRange === "all" ? activityData : activityData.slice(-activityRange);
    const pick = (total: number, us: number) =>
      scope === "us" ? us : scope === "all" ? total : total - us;
    return windowed.map((point) => ({
      label: point.label,
      referrals: pick(point.referrals, point.referralsUS),
      posters: pick(point.posters, point.postersUS),
      completed: pick(point.completed, point.completedUS),
      hoursLogged: pick(point.hoursLogged, point.hoursLoggedUS),
      hoursApproved: pick(point.hoursApproved, point.hoursApprovedUS),
    }));
  }, [activityData, activityRange, scope]);
  const metricLabels: Record<ActivityMetric, string> = {
    referrals: t("metrics.referrals"),
    posters: t("metrics.posters"),
    completed: t("metrics.completed"),
    hoursLogged: t("metrics.hours-logged"),
    hoursApproved: t("metrics.hours-approved"),
  };
  const selectedMetrics = ACTIVITY_METRICS.filter((metric) => activityMetrics.has(metric));
  const hasActivity = selectedMetrics.some((metric) =>
    activitySeries.some((point) => point[metric] > 0),
  );

  const rangeLabels: Record<ActivityRange, string> = {
    7: t("ranges.seven-days"),
    14: t("ranges.fourteen-days"),
    30: t("ranges.thirty-days"),
    90: t("ranges.ninety-days"),
    all: t("ranges.all-time"),
  };

  const fmtRate = (value: number | null) => (value !== null ? rateFormatter.format(value) : "—");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SingleSelect
          value={scope}
          options={[
            { value: "us", label: t("region-us") },
            { value: "all", label: t("region-all") },
            { value: "other", label: t("region-other") },
          ]}
          onChange={setScope}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          glyph="leader"
          label={t("stats.active-ambassadors")}
          value={numberFormatter.format(ambassadorsValue)}
          detail={t("stats.active-of", { total: numberFormatter.format(approvedValue) })}
          hint={t("stats.active-criteria")}
        />
        <StatCard
          glyph="friend"
          label={t("stats.signups-driven")}
          value={numberFormatter.format(signupsValue)}
          detail={t("stats.signups-driven-detail", { count: completedValue })}
        />
        <StatCard
          glyph="bank-account"
          label={t("stats.total-cost")}
          value={
            totalCents !== null
              ? currencyFormatter.format(totalCents / 100)
              : cost.status === "error"
                ? t("stats.cost-unavailable")
                : null
          }
          pending={cost.status === "loading" ? t("stats.cost-crunching") : undefined}
          footer={
            costBuckets.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {costBuckets.map((bucket) => (
                  <div key={bucket.key} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-body text-xs text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: bucket.fill }} />
                      <span className="truncate">{bucket.label}</span>
                    </span>
                    <span className="font-body text-xs text-foreground tabular-nums">
                      {currencyFormatter.format(bucket.cents / 100)}
                    </span>
                  </div>
                ))}
              </div>
            ) : undefined
          }
        />
      </div>

      <section className="bg-card">
        <div className="grid xl:grid-cols-2">
          <section className="min-w-0 p-6">
            <h2 className="mb-6 text-2xl text-foreground">{t("cost-breakdown-title")}</h2>
            {cost.status === "loading" ? (
              <p className="font-body text-base text-foreground/50">{t("stats.cost-crunching")}</p>
            ) : !hasCostBreakdown ? (
              <p className="font-body text-base text-foreground">{t("stats.cost-unavailable")}</p>
            ) : (
              <div className="h-[20rem] min-w-0">
                <DashboardResponsiveChart height={320}>
                  <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <Pie
                      data={costPieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      strokeWidth={0}
                      paddingAngle={1}
                    >
                      {costPieData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Pie>
                    {totalCents !== null ? (
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-current text-2xl text-foreground tabular-nums"
                      >
                        {currencyFormatter.format(totalCents / 100)}
                      </text>
                    ) : null}
                    <Tooltip cursor={false} content={<ChartTooltip locale={locale} currency />} />
                  </PieChart>
                </DashboardResponsiveChart>
              </div>
            )}
          </section>

          <section className="min-w-0 p-6">
            <h2 className="mb-6 text-2xl text-foreground">{t("cost-efficiency-title")}</h2>
            <div className="grid grid-cols-2 items-start gap-x-6 gap-y-6">
              <Kpi
                label={t("efficiency.hours-shipped")}
                value={hoursFormatter.format(totalHoursLogged)}
                sub={t("efficiency.by-users", { count: loggedUsers })}
              />
              <Kpi
                label={t("efficiency.hours-approved")}
                value={hoursFormatter.format(totalHoursApproved)}
                sub={
                  <>
                    <span>{t("efficiency.for-users", { count: approvedUsers })}</span>
                    {totalHoursApproved > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        {t("efficiency.weighted-grants", {
                          count: hoursFormatter.format(weightedGrants),
                          amount: currencyFormatter.format(weightedGrantDollars),
                        })}
                        <HintTooltip text={t("efficiency.weighted-grants-hint")} align="end" />
                      </span>
                    ) : null}
                  </>
                }
              />
              <Kpi
                label={t("efficiency.per-successful-referral")}
                value={cost.status === "loading" ? "…" : fmtRate(perSuccessfulReferral)}
              />
              <Kpi
                label={t("efficiency.per-hour-shipped")}
                value={cost.status === "loading" ? "…" : fmtRate(perHourShipped)}
              />
            </div>
          </section>
        </div>
      </section>

      <section className="bg-card">
        <div className="grid xl:grid-cols-2">
          <section className="min-w-0 p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl text-foreground">{breakdownTitle}</h2>
                {usingStates ? <HintTooltip text={t("signups-by-state-hint")} /> : null}
              </div>
              {usingStates ? (
                <div className="relative w-full sm:w-44">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    placeholder={t("state-search-placeholder")}
                    className="ui-input-surface !bg-muted h-8 w-full !rounded-none border-0 pl-8 pr-3 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/15"
                  />
                </div>
              ) : null}
            </div>
            {hasBreakdownData ? (
              <div className="min-w-0" style={{ height: `${breakdownHeight}px` }}>
                <DashboardResponsiveChart height={breakdownHeight}>
                  <BarChart
                    data={breakdownBarData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--foreground)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      domain={[0, getBarChartAxisMax(breakdownBarData)]}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "var(--foreground)", fontSize: 13 }}
                      axisLine={false}
                      tickLine={false}
                      width={150}
                    />
                    <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                      {breakdownBarData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </DashboardResponsiveChart>
              </div>
            ) : (
              <p className="font-body text-base text-foreground">{t("signups-by-region-empty")}</p>
            )}
          </section>

          <section className="min-w-0 p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl text-foreground">{t("recent-activity-title")}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <MultiSelect
                  options={ACTIVITY_METRICS.map((metric) => ({
                    value: metric,
                    label: metricLabels[metric],
                  }))}
                  selected={activityMetrics}
                  onChange={setActivityMetrics}
                  allLabel={tc("top-ambassadors-all-metrics")}
                  selectionNoun={tc("top-ambassadors-metrics-noun")}
                />
                <SingleSelect
                  value={activityRange}
                  options={ACTIVITY_RANGES.map((range) => ({
                    value: range,
                    label: rangeLabels[range],
                  }))}
                  onChange={setActivityRange}
                />
              </div>
            </div>
            {hasActivity ? (
              <div className="h-[20rem] min-w-0">
                <DashboardResponsiveChart height={320}>
                  <ComposedChart
                    data={activitySeries}
                    margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--foreground)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: "var(--foreground)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--foreground)", strokeWidth: 1 }}
                      content={<ChartTooltip locale={locale} />}
                    />
                    {selectedMetrics.map((metric) => (
                      <Line
                        key={metric}
                        type="monotone"
                        dataKey={metric}
                        name={metricLabels[metric]}
                        stroke={METRIC_STROKE[metric]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: METRIC_STROKE[metric] }}
                      />
                    ))}
                  </ComposedChart>
                </DashboardResponsiveChart>
              </div>
            ) : (
              <p className="font-body text-base text-foreground">{t("activity-empty")}</p>
            )}
          </section>
        </div>

        <TopAmbassadorsChart
          data={topAmbassadorsData}
          locale={locale}
          region={topRegion}
          showFlags
          rangeAsDropdown
          includeBalance
          defaultSelectedMetrics={["referrals"]}
          messages={{
            title: tc("top-ambassadors-title"),
            empty: tc("top-ambassadors-empty"),
            allMetrics: tc("top-ambassadors-all-metrics"),
            metricsNoun: tc("top-ambassadors-metrics-noun"),
            postersSeries: tc("series.posters"),
            referralsSeries: tc("series.referrals"),
            rsvpsSeries: tc("series.rsvps"),
            balanceSeries: tc("top-ambassadors-balance"),
          }}
        />
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-sm text-secondary">{label}</span>
      <span className="text-2xl leading-none text-foreground tabular-nums">{value}</span>
      {sub !== undefined ? (
        <div className="flex flex-col gap-0.5 font-body text-xs text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

function StatCard({
  glyph,
  label,
  value,
  detail,
  pending,
  hint,
  footer,
}: {
  glyph: "leader" | "friend" | "bank-account";
  label: string;
  value: string | null;
  detail?: string;
  pending?: string;
  hint?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border border-foreground/10 bg-card p-6">
      <div className="flex items-center gap-2.5">
        <Icon glyph={glyph} size={28} className="shrink-0 text-foreground" />
        <span className="font-body text-sm text-secondary">{label}</span>
        {hint !== undefined ? <HintTooltip text={hint} /> : null}
      </div>
      {value !== null ? (
        <span className="text-4xl leading-none text-foreground tabular-nums">{value}</span>
      ) : (
        <span className="font-body text-base text-foreground/50">{pending}</span>
      )}
      {detail !== undefined && value !== null ? (
        <span className="font-body text-xs text-muted-foreground">{detail}</span>
      ) : null}
      {footer !== undefined && value !== null ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}

function HintTooltip({ text, align = "center" }: { text: string; align?: "center" | "end" }) {
  const position = align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex">
      <InfoIcon
        tabIndex={0}
        aria-label={text}
        className="size-3.5 cursor-help text-muted-foreground outline-none"
      />
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-1.5 hidden w-max max-w-[16rem] border border-foreground/10 bg-popover px-2.5 py-1.5 font-body text-xs leading-snug text-popover-foreground shadow-lg group-hover:block group-focus-within:block ${position}`}
      >
        {text}
      </span>
    </span>
  );
}
