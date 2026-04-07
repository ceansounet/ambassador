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

const initialChartWidth = 640;

export type DashboardActivityPoint = {
  label: string;
  visits: number;
  signups: number;
  applications: number;
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
    noFlowData: string;
    stillPending: string;
    visitsSeries: string;
    signupsSeries: string;
    applicationsSeries: string;
  };
};

export function AdminDashboardCharts({
  activityData,
  decisionData,
  funnelData,
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
  const hasApplicationFlowData = flowChartData.some((step) => step.value > 0);

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
                    size="sm"
                    variant="default"
                    className={
                      option.value === activeRange
                        ? "bg-white !text-black hover:bg-white hover:!text-black"
                        : "bg-primary text-white hover:bg-white hover:text-black"
                    }
                  >
                    <Link href={href}>{option.label}</Link>
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="h-80 min-w-0">
            <DashboardResponsiveChart height={320}>
              <ComposedChart
                data={activityData}
                margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
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
                  width={28}
                />
                <Tooltip
                  cursor={{ stroke: "var(--foreground)", strokeWidth: 1 }}
                  content={<ChartTooltip locale={locale} />}
                />
                <Line
                  type="monotone"
                  dataKey="visits"
                  name={messages.visitsSeries}
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="signups"
                  name={messages.signupsSeries}
                  stroke="var(--secondary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--secondary)" }}
                />
                <Line
                  type="monotone"
                  dataKey="applications"
                  name={messages.applicationsSeries}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--primary)" }}
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
            {hasApplicationFlowData ? (
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
            ) : (
              <div className="flex h-full items-center justify-center font-body text-base text-white">
                {messages.noFlowData}
              </div>
            )}
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
      initialDimension={{ width: initialChartWidth, height }}
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
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white bg-black px-4 py-3">
      {label ? <div className="mb-2 font-body text-sm text-secondary">{label}</div> : null}
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
      fill: funnelData[0]?.fill ?? "var(--foreground)",
    },
    {
      name: funnelData[1]?.name ?? "",
      value: signedUp,
      fill: funnelData[1]?.fill ?? "var(--secondary)",
    },
    {
      name: funnelData[2]?.name ?? "",
      value: filledForm,
      fill: funnelData[2]?.fill ?? "var(--primary)",
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
  const approved = clampToParent(funnelData[3]?.value ?? 0, applicants);
  const denied = clampToParent(funnelData[4]?.value ?? 0, applicants);
  const pending = clampToParent(pendingCount, applicants);

  return [
    {
      name: funnelData[3]?.name ?? "",
      value: approved,
      fill: funnelData[3]?.fill ?? "var(--acceptance)",
      share: applicants > 0 ? (approved / applicants) * 100 : 0,
    },
    {
      name: funnelData[4]?.name ?? "",
      value: denied,
      fill: funnelData[4]?.fill ?? "var(--rejection)",
      share: applicants > 0 ? (denied / applicants) * 100 : 0,
    },
    {
      name: pendingLabel,
      value: pending,
      fill: "var(--secondary)",
      share: applicants > 0 ? (pending / applicants) * 100 : 0,
    },
  ].filter((step) => step.name);
}

function clampToParent(value: number, max: number) {
  if (max <= 0) return 0;

  return Math.min(value, max);
}
