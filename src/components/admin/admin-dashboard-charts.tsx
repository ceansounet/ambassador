"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartTooltip,
  DashboardResponsiveChart,
  getBarChartAxisMax,
  type DashboardActivityPoint,
  type DashboardBreakdownPoint,
  type DashboardFunnelPoint,
  type DashboardTopAmbassadorPoint,
} from "@/components/admin/dashboard-chart-primitives";
import { TopAmbassadorsChart } from "@/components/admin/top-ambassadors-chart";
import { Button } from "@/components/ui/button";

// Re-export the shared chart point types so existing importers keep working.
export type {
  DashboardActivityPoint,
  DashboardBreakdownPoint,
  DashboardFunnelPoint,
  DashboardTopAmbassadorPoint,
};

type DashboardFlowMetric = {
  name: string;
  value: number;
  fill: string;
  share: number;
};

type RangeOption = {
  value: string;
  label: string;
};

type AdminDashboardChartsProps = {
  activityData: DashboardActivityPoint[];
  decisionData: DashboardBreakdownPoint[];
  funnelData: DashboardFunnelPoint[];
  referralDropOffData: DashboardBreakdownPoint[];
  posterStatusData: DashboardBreakdownPoint[];
  topAmbassadorsData: DashboardTopAmbassadorPoint[];
  pendingCount: number;
  locale: string;
  activeRange: string;
  rangeOptions: readonly RangeOption[];
  messages: {
    recentActivityEyebrow: string;
    recentActivityTitle: string;
    decisionSplitEyebrow: string;
    decisionSplitTitle: string;
    applicationFlowEyebrow: string;
    applicationFlowTitle: string;
    referralDropOffTitle: string;
    posterStatusTitle: string;
    topAmbassadorsTitle: string;
    topAmbassadorsEmpty: string;
    topAmbassadorsAllMetrics: string;
    topAmbassadorsMetricsNoun: string;
    topAmbassadorsBalance: string;
    stillPending: string;
    visitsSeries: string;
    signupsSeries: string;
    applicationsSeries: string;
    postersSeries: string;
    referralsSeries: string;
    rsvpsSeries: string;
  };
};

export function AdminDashboardCharts({
  activityData,
  decisionData,
  funnelData,
  referralDropOffData,
  posterStatusData,
  topAmbassadorsData,
  pendingCount,
  locale,
  activeRange,
  rangeOptions,
  messages,
}: AdminDashboardChartsProps) {
  const selectedRangeLabel =
    rangeOptions.find((option) => option.value === activeRange)?.label ?? rangeOptions[1]?.label;
  const applicationFunnelData = buildApplicationFunnelData(funnelData);
  const stageMetrics = buildStageMetrics(applicationFunnelData);
  const outcomeMetrics = buildOutcomeMetrics(funnelData, pendingCount, messages.stillPending);
  const flowChartData = [...stageMetrics, ...outcomeMetrics];

  return (
    <section className="overflow-hidden bg-card">
      <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
        <section className="min-w-0 p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-body text-sm text-secondary">{messages.recentActivityEyebrow}</p>
              <h2 className="text-2xl text-foreground">{selectedRangeLabel}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => {
                const href = option.value === "14d" ? "/admin?view=detailed" : `/admin?view=detailed&range=${option.value}`;

                return (
                  <Button
                    key={option.value}
                    asChild
                    size="app-sm"
                    variant="destructive"
                    selected={option.value === activeRange}
                  >
                    <Link
                      href={href}
                      aria-current={option.value === activeRange ? "page" : undefined}
                    >
                      {option.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="h-80 min-w-0">
            <DashboardResponsiveChart height={320}>
              <ComposedChart
                data={activityData}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
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
                <Line
                  type="monotone"
                  dataKey="visits"
                  name={messages.visitsSeries}
                  stroke="var(--chart-visits)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-visits)" }}
                />
                <Line
                  type="monotone"
                  dataKey="signups"
                  name={messages.signupsSeries}
                  stroke="var(--chart-signups)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-signups)" }}
                />
                <Line
                  type="monotone"
                  dataKey="applications"
                  name={messages.applicationsSeries}
                  stroke="var(--chart-applications)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-applications)" }}
                />
                <Line
                  type="monotone"
                  dataKey="posters"
                  name={messages.postersSeries}
                  stroke="var(--chart-approved)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-approved)" }}
                />
                <Line
                  type="monotone"
                  dataKey="referrals"
                  name={messages.referralsSeries}
                  stroke="var(--chart-rejected)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-rejected)" }}
                />
              </ComposedChart>
            </DashboardResponsiveChart>
          </div>
        </section>

        <section className="min-w-0 p-6">
          <div className="mb-6 space-y-1">
            <p className="font-body text-sm text-secondary">{messages.decisionSplitEyebrow}</p>
            <h2 className="text-2xl text-foreground">{messages.decisionSplitTitle}</h2>
          </div>
          <div className="h-80 min-w-0">
            <DashboardResponsiveChart height={320}>
              <BarChart
                data={decisionData}
                layout="vertical"
                margin={{ top: 12, right: 12, left: 8, bottom: 12 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: "var(--foreground)", fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                  width={88}
                />
                <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                  {decisionData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </DashboardResponsiveChart>
          </div>
        </section>
      </div>

      <div className="p-6">
        <div className="min-w-0">
          <h2 className="mb-6 text-2xl text-foreground">{messages.applicationFlowTitle}</h2>
          <div className="h-[24rem] min-w-0">
            <DashboardResponsiveChart height={384}>
              <BarChart
                data={flowChartData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, getBarChartAxisMax(flowChartData)]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "var(--foreground)", fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                  width={136}
                />
                <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                  {flowChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </DashboardResponsiveChart>
          </div>
        </div>
      </div>

      <TopAmbassadorsChart
        data={topAmbassadorsData}
        locale={locale}
        messages={{
          title: messages.topAmbassadorsTitle,
          empty: messages.topAmbassadorsEmpty,
          allMetrics: messages.topAmbassadorsAllMetrics,
          metricsNoun: messages.topAmbassadorsMetricsNoun,
          postersSeries: messages.postersSeries,
          referralsSeries: messages.referralsSeries,
          rsvpsSeries: messages.rsvpsSeries,
          balanceSeries: messages.topAmbassadorsBalance,
        }}
      />

      <div className="grid xl:grid-cols-2">
        <div className="p-6">
          <div className="min-w-0">
            <h2 className="mb-6 text-2xl text-foreground">{messages.referralDropOffTitle}</h2>
            <div className="h-[20rem] min-w-0">
              <DashboardResponsiveChart height={320}>
                <BarChart
                  data={referralDropOffData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--foreground)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, getBarChartAxisMax(referralDropOffData)]}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: "var(--foreground)", fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                    {referralDropOffData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </DashboardResponsiveChart>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="min-w-0">
            <h2 className="mb-6 text-2xl text-foreground">{messages.posterStatusTitle}</h2>
            <div className="h-[20rem] min-w-0">
              <DashboardResponsiveChart height={320}>
                <BarChart
                  data={posterStatusData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--foreground)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, getBarChartAxisMax(posterStatusData)]}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: "var(--foreground)", fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                    {posterStatusData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </DashboardResponsiveChart>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

function buildApplicationFunnelData(funnelData: DashboardFunnelPoint[]) {
  const visited = Math.max(funnelData[0]?.value ?? 0, 0);
  const signedUp = clampToParent(funnelData[1]?.value ?? 0, visited);
  const filledForm = clampToParent(funnelData[2]?.value ?? 0, signedUp);

  return [
    {
      name: funnelData[0]?.name ?? "",
      value: visited,
      fill: funnelData[0]?.fill ?? "var(--chart-visits)",
    },
    {
      name: funnelData[1]?.name ?? "",
      value: signedUp,
      fill: funnelData[1]?.fill ?? "var(--chart-signups)",
    },
    {
      name: funnelData[2]?.name ?? "",
      value: filledForm,
      fill: funnelData[2]?.fill ?? "var(--chart-applications)",
    },
  ].filter((step) => step.name);
}

function buildStageMetrics(funnelData: DashboardFunnelPoint[]): DashboardFlowMetric[] {
  const baseline = Math.max(funnelData[0]?.value ?? 0, 0);

  return funnelData.map((step) => ({
    name: step.name,
    value: step.value,
    fill: step.fill,
    share: baseline > 0 ? (step.value / baseline) * 100 : 0,
  }));
}

function buildOutcomeMetrics(
  funnelData: DashboardFunnelPoint[],
  pendingCount: number,
  pendingLabel: string,
): DashboardFlowMetric[] {
  const applicants = Math.max(funnelData[2]?.value ?? 0, 0);
  const pending = clampToParent(pendingCount, applicants);
  const outcomes = funnelData.slice(3).map((step, index) => {
    const value = clampToParent(step.value, applicants);
    const fallbackFill =
      index === 0
        ? "var(--chart-approved)"
        : index === 1
          ? "var(--chart-rejected)"
          : "var(--chart-banned)";

    return {
      name: step.name,
      value,
      fill: step.fill || fallbackFill,
      share: applicants > 0 ? (value / applicants) * 100 : 0,
    };
  });

  return [
    ...outcomes,
    {
      name: pendingLabel,
      value: pending,
      fill: "var(--chart-pending)",
      share: applicants > 0 ? (pending / applicants) * 100 : 0,
    },
  ].filter((step) => step.name);
}

function clampToParent(value: number, max: number) {
  if (max <= 0) return 0;

  return Math.min(value, max);
}
