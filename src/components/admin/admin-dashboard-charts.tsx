"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";

export type DashboardActivityPoint = {
  label: string;
  visits: number;
  signups: number;
  applications: number;
  posters: number;
  referrals: number;
};

export type DashboardBreakdownPoint = {
  label: string;
  value: number;
  fill: string;
};

export type DashboardFunnelPoint = {
  name: string;
  value: number;
  fill: string;
};

export type DashboardTopAmbassadorPoint = {
  userId: string;
  name: string;
  posters: number;
  verifiedPosters: number;
  referrals: number;
  verifiedReferrals: number;
  rsvps: number;
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
              <h2 className="text-2xl text-white">{selectedRangeLabel}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => {
                const href = option.value === "14d" ? "/admin" : `/admin?range=${option.value}`;

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
            <h2 className="text-2xl text-white">{messages.decisionSplitTitle}</h2>
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
          <h2 className="mb-6 text-2xl text-white">{messages.applicationFlowTitle}</h2>
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

      <div className="p-6">
        <div className="min-w-0">
          <h2 className="mb-6 text-2xl text-white">{messages.topAmbassadorsTitle}</h2>
          {topAmbassadorsData.length === 0 ? (
            <p className="font-body text-base text-white">{messages.topAmbassadorsEmpty}</p>
          ) : (
            <div
              className="min-w-0"
              style={{ height: `${Math.max(240, topAmbassadorsData.length * 44)}px` }}
            >
              <DashboardResponsiveChart height={Math.max(240, topAmbassadorsData.length * 44)}>
                <BarChart
                  data={topAmbassadorsData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--foreground)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "var(--foreground)", fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                    width={160}
                  />
                  <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                  <Bar
                    dataKey="posters"
                    name={messages.postersSeries}
                    stackId="a"
                    fill="var(--chart-approved)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="referrals"
                    name={messages.referralsSeries}
                    stackId="a"
                    fill="var(--chart-rejected)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="rsvps"
                    name={messages.rsvpsSeries}
                    stackId="a"
                    fill="var(--chart-signups)"
                    radius={[0, 10, 10, 0]}
                  />
                </BarChart>
              </DashboardResponsiveChart>
            </div>
          )}
        </div>
      </div>

      <div className="grid xl:grid-cols-2">
        <div className="p-6">
          <div className="min-w-0">
            <h2 className="mb-6 text-2xl text-white">{messages.referralDropOffTitle}</h2>
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
            <h2 className="mb-6 text-2xl text-white">{messages.posterStatusTitle}</h2>
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

function DashboardResponsiveChart({
  children,
  height,
}: {
  children: React.ReactNode;
  height: number;
}) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      minHeight={height}
      initialDimension={{ width: 640, height }}
    >
      {children}
    </ResponsiveContainer>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
  locale,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    fill?: string;
  }>;
  locale: string;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-white bg-black px-4 py-3">
      {label !== undefined && label !== "" ? <div className="mb-2 font-body text-sm text-secondary">{label}</div> : null}
      <div className="space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-body text-sm text-white">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color ?? item.fill ?? "var(--foreground)" }}
              />
              <span>{item.name}</span>
            </div>
            <span className="font-body text-sm text-white">
              {new Intl.NumberFormat(locale).format(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
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

function getBarChartAxisMax(data: Array<{ value: number }>) {
  return Math.max(1, ...data.map((entry) => Math.max(entry.value, 0)));
}
