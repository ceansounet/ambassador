"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartTooltip,
  DashboardResponsiveChart,
  type DashboardTopAmbassadorPoint,
} from "@/components/admin/dashboard-chart-primitives";
import { MultiSelect, SingleSelect } from "@/components/admin/dashboard-selects";
import { SectionHeading } from "@/components/admin/section-heading";
import { Button } from "@/components/ui/button";
import { ambassadorRegionFlag } from "@/lib/settings";

export type TopAmbassadorsChartMessages = {
  title: string;
  empty: string;
  allMetrics: string;
  metricsNoun: string;
  postersSeries: string;
  referralsSeries: string;
  rsvpsSeries: string;
  balanceSeries: string;
};

type TopAmbassadorMetric = "posters" | "referrals" | "rsvps" | "balance";

// Order matches the original detailed-view stacking; balance is appended and
// only surfaced when includeBalance is set (priority view).
const METRIC_DEFS: { key: TopAmbassadorMetric; dataKey: string; fill: string }[] = [
  { key: "posters", dataKey: "verifiedPosters", fill: "var(--chart-approved)" },
  { key: "referrals", dataKey: "verifiedReferrals", fill: "var(--primary)" },
  { key: "rsvps", dataKey: "rsvps", fill: "var(--chart-signups)" },
  { key: "balance", dataKey: "balanceDollars", fill: "var(--chart-visits)" },
];

type TopAmbassadorRange = "7d" | "month" | "all";

function isTopAmbassadorPointArray(value: unknown): value is DashboardTopAmbassadorPoint[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return false;
      }

      const region = Reflect.get(entry, "region");
      const state = Reflect.get(entry, "state");

      return (
        typeof Reflect.get(entry, "userId") === "string" &&
        typeof Reflect.get(entry, "name") === "string" &&
        (typeof region === "string" || region === null) &&
        (typeof state === "string" || state === null) &&
        typeof Reflect.get(entry, "posters") === "number" &&
        typeof Reflect.get(entry, "verifiedPosters") === "number" &&
        typeof Reflect.get(entry, "referrals") === "number" &&
        typeof Reflect.get(entry, "verifiedReferrals") === "number" &&
        typeof Reflect.get(entry, "rsvps") === "number" &&
        typeof Reflect.get(entry, "balanceCents") === "number"
      );
    })
  );
}

/**
 * Ranked, paginated ambassadors with a metric multi-select and range toggle.
 * The all-time/all-region slice is server-rendered and seeded into the cache;
 * every other (range, region) slice is fetched lazily and memoized.
 *
 * Detailed view uses the bare component (red range buttons, no region picker,
 * all metrics). The priority view opts into `rangeAsDropdown`, `includeBalance`
 * (a $ balance metric), a `referrals`-only default via `defaultSelectedMetrics`,
 * and drives `region` from the page scope ("all" | "non-us" | a region name).
 * For the United States it shows a by-state filter instead of a region picker.
 */
export function TopAmbassadorsChart({
  data,
  locale,
  messages,
  region = "all",
  showFlags = false,
  rangeAsDropdown = false,
  includeBalance = false,
  defaultSelectedMetrics,
}: {
  data: DashboardTopAmbassadorPoint[];
  locale: string;
  messages: TopAmbassadorsChartMessages;
  region?: string;
  showFlags?: boolean;
  rangeAsDropdown?: boolean;
  includeBalance?: boolean;
  defaultSelectedMetrics?: TopAmbassadorMetric[];
}) {
  const t = useTranslations("admin.overview.charts");
  const tp = useTranslations("admin.pagination");

  const metricDefs = useMemo(
    () => METRIC_DEFS.filter((metric) => includeBalance || metric.key !== "balance"),
    [includeBalance],
  );
  const metricLabels: Record<TopAmbassadorMetric, string> = {
    posters: messages.postersSeries,
    referrals: messages.referralsSeries,
    rsvps: messages.rsvpsSeries,
    balance: messages.balanceSeries,
  };

  const [selected, setSelected] = useState<Set<TopAmbassadorMetric>>(
    () =>
      new Set(
        defaultSelectedMetrics ?? metricDefs.filter((m) => m.key !== "balance").map((m) => m.key),
      ),
  );
  const [range, setRange] = useState<TopAmbassadorRange>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const activeRegion = region;
  const isUSRegion = activeRegion === "United States";
  // Flags distinguish a multi-region view; a single region drills into its
  // states/provinces via a name suffix (dropped once one state is picked).
  const displayFlags = showFlags && (activeRegion === "all" || activeRegion === "non-us");
  const showState = !displayFlags && activeRegion !== "all" && stateFilter === "all";
  // The slice the server pre-rendered (captured once); never overwritten by a
  // later region prop, since `data` always corresponds to this initial region.
  const [seedRegion] = useState(region);
  const seedKey = `all:${seedRegion}`;

  // Seed the cache with the server-rendered slice so the default view paints
  // instantly; other slices are fetched lazily and memoized by `${range}:${region}`.
  const [cache, setCache] = useState<Record<string, DashboardTopAmbassadorPoint[]>>(
    () => ({ [seedKey]: data }),
  );
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Keep the server-rendered slice fresh when the server re-renders.
  useEffect(() => {
    setCache((prev) => ({ ...prev, [seedKey]: data }));
  }, [data, seedKey]);

  const cacheKey = `${range}:${activeRegion}`;
  const rangeData = cache[cacheKey];

  // Fetch the selected slice on demand; cached slices short-circuit.
  useEffect(() => {
    if (rangeData !== undefined) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function loadSlice() {
      try {
        const response = await fetch(
          `/api/admin/top-ambassadors?range=${range}&region=${encodeURIComponent(activeRegion)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return;
        }
        const result = (await response.json()) as unknown;
        const ambassadors =
          typeof result === "object" && result !== null
            ? Reflect.get(result, "ambassadors")
            : null;
        if (!cancelled && isTopAmbassadorPointArray(ambassadors)) {
          setCache((prev) => ({ ...prev, [cacheKey]: ambassadors }));
        }
      } catch {
        // Swallow; the chart falls back to the empty state on failure.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSlice();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, rangeData, range, activeRegion]);

  // A specific region resets any state filter from a previous region.
  useEffect(() => {
    setStateFilter("all");
  }, [activeRegion]);

  // Reset to the first page whenever the view (slice, metric, or state) changes.
  useEffect(() => {
    setPage(1);
  }, [cacheKey, selected, stateFilter]);

  // US states present in the loaded slice, for the by-state filter.
  const stateOptions = useMemo(() => {
    if (!isUSRegion || rangeData === undefined) {
      return [];
    }
    const set = new Set<string>();
    for (const entry of rangeData) {
      if (entry.state) {
        set.add(entry.state);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [isUSRegion, rangeData]);

  const activeMetrics = metricDefs.filter((metric) => selected.has(metric.key));

  const sortedData = useMemo(() => {
    if (rangeData === undefined) {
      return [];
    }

    const base =
      stateFilter === "all" ? rangeData : rangeData.filter((entry) => entry.state === stateFilter);

    return base
      .map((entry) => {
        const withBalance = { ...entry, balanceDollars: (entry.balanceCents ?? 0) / 100 };
        const total = activeMetrics.reduce(
          (sum, metric) => sum + Number(Reflect.get(withBalance, metric.dataKey) ?? 0),
          0,
        );
        return { ...withBalance, total };
      })
      // Stable, deterministic tie-break by name so equal totals don't reshuffle.
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [rangeData, activeMetrics, stateFilter]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);
  const chartHeight = Math.max(240, pageData.length * 44);
  const isPending = loading && rangeData === undefined;

  return (
    <div className="min-w-0">
      <div className="min-w-0">
        <SectionHeading title={messages.title}>
            {isUSRegion && stateOptions.length > 0 ? (
              <SingleSelect
                value={stateFilter}
                options={[
                  { value: "all", label: t("top-ambassadors-all-states") },
                  ...stateOptions.map((s) => ({ value: s, label: s })),
                ]}
                onChange={setStateFilter}
              />
            ) : null}
            {rangeAsDropdown ? (
              <SingleSelect
                value={range}
                options={[
                  { value: "all", label: t("top-ambassadors-ranges.all-time") },
                  { value: "7d", label: t("top-ambassadors-ranges.last-seven-days") },
                  { value: "month", label: t("top-ambassadors-ranges.last-month") },
                ]}
                onChange={setRange}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all" as const, label: t("top-ambassadors-ranges.all-time") },
                  { value: "7d" as const, label: t("top-ambassadors-ranges.last-seven-days") },
                  { value: "month" as const, label: t("top-ambassadors-ranges.last-month") },
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="app-sm"
                    variant="destructive"
                    selected={option.value === range}
                    aria-pressed={option.value === range}
                    onClick={() => setRange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
            <MultiSelect
              options={metricDefs.map((metric) => ({
                value: metric.key,
                label: metricLabels[metric.key],
              }))}
              selected={selected}
              onChange={setSelected}
              allLabel={messages.allMetrics}
              selectionNoun={messages.metricsNoun}
            />
        </SectionHeading>
        {isPending ? (
          <TopAmbassadorsSkeleton label={t("top-ambassadors-loading")} />
        ) : pageData.length === 0 ? (
          <p className="font-body text-base text-foreground">{messages.empty}</p>
        ) : (
          <>
            <div className="min-w-0" style={{ height: `${chartHeight}px` }}>
              <DashboardResponsiveChart height={chartHeight}>
                <BarChart
                  data={pageData}
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
                    tick={
                      <AmbassadorTick data={pageData} showFlags={displayFlags} showState={showState} />
                    }
                    axisLine={false}
                    tickLine={false}
                    width={displayFlags || showState ? 200 : 160}
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
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-4 pt-4 font-body text-sm">
                <span className="text-secondary tabular-nums">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedData.length)}{" "}
                  {tp("of")} {sortedData.length}
                </span>
                <div className="flex items-center gap-1">
                  {safePage > 1 ? (
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      aria-label={tp("previous")}
                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-md text-foreground/25">
                      <ChevronLeft className="size-4" />
                    </span>
                  )}
                  <span className="px-2 text-foreground tabular-nums">
                    {safePage} / {pageCount}
                  </span>
                  {safePage < pageCount ? (
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      aria-label={tp("next")}
                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-md text-foreground/25">
                      <ChevronRight className="size-4" />
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// On-grid placeholder for the lazily fetched slice: ten rows on the chart's
// 44px rhythm, each a name stub plus a pulsing bar of varied width, so loading
// reads as the ranked bars about to arrive rather than a line of text.
function TopAmbassadorsSkeleton({ label }: { label: string }) {
  const widths = ["92%", "78%", "70%", "64%", "58%", "52%", "46%", "40%", "34%", "28%"];

  return (
    <div role="status" aria-label={label} className="min-w-0" style={{ height: 440 }}>
      <div className="flex h-full flex-col justify-between py-2">
        {widths.map((width, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="h-3 w-32 shrink-0 animate-pulse rounded-none bg-muted" />
            <span className="h-5 animate-pulse rounded-none bg-muted" style={{ width }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AmbassadorTick(props: {
  x?: number;
  y?: number;
  payload?: { index?: number; value?: string };
  data?: DashboardTopAmbassadorPoint[];
  showFlags?: boolean;
  showState?: boolean;
}) {
  const { x = 0, y = 0, payload, data, showFlags = false, showState = false } = props;
  const index = payload?.index ?? 0;
  const entry = data?.[index];
  const baseName = payload?.value ?? entry?.name ?? "";
  const name = showFlags
    ? `${ambassadorRegionFlag(entry?.region)}  ${baseName}`
    : showState && entry?.state
      ? `${baseName} (${entry.state})`
      : baseName;

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
