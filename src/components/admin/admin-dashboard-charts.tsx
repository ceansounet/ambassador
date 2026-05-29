"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
    topAmbassadorsAllMetrics: string;
    topAmbassadorsMetricsNoun: string;
    stillPending: string;
    visitsSeries: string;
    signupsSeries: string;
    applicationsSeries: string;
    postersSeries: string;
    referralsSeries: string;
    rsvpsSeries: string;
  };
};

type TopAmbassadorMetric = "posters" | "referrals" | "rsvps";

const TOP_AMBASSADOR_METRICS: {
  key: TopAmbassadorMetric;
  dataKey: keyof DashboardTopAmbassadorPoint;
  fill: string;
}[] = [
  { key: "posters", dataKey: "verifiedPosters", fill: "var(--chart-approved)" },
  { key: "referrals", dataKey: "verifiedReferrals", fill: "var(--chart-rejected)" },
  { key: "rsvps", dataKey: "rsvps", fill: "var(--chart-signups)" },
];

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

      <TopAmbassadorsChart data={topAmbassadorsData} locale={locale} messages={messages} />

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

function TopAmbassadorsChart({
  data,
  locale,
  messages,
}: {
  data: DashboardTopAmbassadorPoint[];
  locale: string;
  messages: AdminDashboardChartsProps["messages"];
}) {
  const metricLabels: Record<TopAmbassadorMetric, string> = {
    posters: messages.postersSeries,
    referrals: messages.referralsSeries,
    rsvps: messages.rsvpsSeries,
  };
  const [selected, setSelected] = useState<Set<TopAmbassadorMetric>>(
    () => new Set(TOP_AMBASSADOR_METRICS.map((metric) => metric.key)),
  );
  const activeMetrics = TOP_AMBASSADOR_METRICS.filter((metric) => selected.has(metric.key));

  const sortedData = useMemo(() => {
    return [...data]
      .map((entry) => ({
        ...entry,
        total: activeMetrics.reduce(
          (sum, metric) => sum + Number(entry[metric.dataKey] ?? 0),
          0,
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [data, activeMetrics]);

  const chartHeight = Math.max(240, sortedData.length * 44);

  return (
    <div className="p-6">
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl text-white">{messages.topAmbassadorsTitle}</h2>
          <MetricMultiSelect
            metrics={TOP_AMBASSADOR_METRICS.map((metric) => metric.key)}
            labels={metricLabels}
            selected={selected}
            onChange={setSelected}
            allLabel={messages.topAmbassadorsAllMetrics}
            selectionNoun={messages.topAmbassadorsMetricsNoun}
          />
        </div>
        {data.length === 0 ? (
          <p className="font-body text-base text-white">{messages.topAmbassadorsEmpty}</p>
        ) : (
          <div className="min-w-0" style={{ height: `${chartHeight}px` }}>
            <DashboardResponsiveChart height={chartHeight}>
              <BarChart
                data={sortedData}
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
                  tick={<AmbassadorTick data={sortedData} />}
                  axisLine={false}
                  tickLine={false}
                  width={160}
                />
                <Tooltip cursor={false} content={<ChartTooltip locale={locale} />} />
                {activeMetrics.map((metric, index) => (
                  <Bar
                    key={metric.key}
                    dataKey={metric.dataKey}
                    name={metricLabels[metric.key]}
                    stackId="a"
                    fill={metric.fill}
                    radius={index === activeMetrics.length - 1 ? [0, 10, 10, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </DashboardResponsiveChart>
          </div>
        )}
      </div>
    </div>
  );
}

function AmbassadorTick(props: {
  x?: number;
  y?: number;
  payload?: { index?: number; value?: string };
  data?: DashboardTopAmbassadorPoint[];
}) {
  const { x = 0, y = 0, payload, data } = props;
  const index = payload?.index ?? 0;
  const entry = data?.[index];
  const name = payload?.value ?? entry?.name ?? "";

  if (!entry) {
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fill="var(--foreground)" fontSize={13}>
        {name}
      </text>
    );
  }

  return (
    <a href={`/admin/users/${entry.userId}`} className="ui-hover-underline">
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill="var(--foreground)"
        fontSize={13}
        style={{ cursor: "pointer" }}
      >
        {name}
      </text>
    </a>
  );
}

function MetricMultiSelect({
  metrics,
  labels,
  selected,
  onChange,
  allLabel,
  selectionNoun,
}: {
  metrics: TopAmbassadorMetric[];
  labels: Record<TopAmbassadorMetric, string>;
  selected: Set<TopAmbassadorMetric>;
  onChange: (next: Set<TopAmbassadorMetric>) => void;
  allLabel: string;
  selectionNoun: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function toggle(metric: TopAmbassadorMetric) {
    const next = new Set(selected);
    if (next.has(metric)) {
      next.delete(metric);
    } else {
      next.add(metric);
    }
    onChange(next);
  }

  const allSelected = selected.size === metrics.length;
  const label = allSelected
    ? allLabel
    : selected.size === 1
      ? labels[Array.from(selected)[0]]
      : `${selected.size} ${selectionNoun}`;

  return (
    <div ref={ref} className="relative w-full sm:w-56">
      <button
        type="button"
        data-slot="multiselect-trigger"
        onClick={() => setOpen(!open)}
        className="ui-input-surface !bg-muted inline-flex h-8 w-full !rounded-none [border-radius:0!important] items-center justify-between gap-1.5 border-0 px-3 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/15"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          data-slot="multiselect-content"
          className="absolute right-0 z-50 mt-1 w-full overflow-hidden bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5"
        >
          {metrics.map((metric) => {
            const checked = selected.has(metric);
            return (
              <button
                key={metric}
                type="button"
                data-slot="multiselect-item"
                onClick={() => toggle(metric)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {checked ? (
                  <CheckIcon className="size-4 shrink-0 text-[var(--acceptance)]" aria-hidden="true" />
                ) : (
                  <span className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{labels[metric]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
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
