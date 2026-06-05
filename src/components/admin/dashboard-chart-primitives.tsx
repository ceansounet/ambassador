"use client";

import { ResponsiveContainer } from "recharts";

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
  region: string | null;
  state: string | null;
  posters: number;
  verifiedPosters: number;
  referrals: number;
  verifiedReferrals: number;
  rsvps: number;
  balanceCents: number;
};

export function DashboardResponsiveChart({
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

export function ChartTooltip({
  active,
  label,
  payload,
  locale,
  currency = false,
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
  currency?: boolean;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const formatter = currency
    ? new Intl.NumberFormat(locale, { style: "currency", currency: "USD" })
    : new Intl.NumberFormat(locale);

  return (
    <div className="rounded-xl border border-foreground bg-background px-4 py-3">
      {label !== undefined && label !== "" ? (
        <div className="mb-2 font-body text-sm text-secondary">{label}</div>
      ) : null}
      <div className="space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-body text-sm text-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color ?? item.fill ?? "var(--foreground)" }}
              />
              <span>{item.name}</span>
            </div>
            <span className="font-body text-sm text-foreground">
              {formatter.format(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function getBarChartAxisMax(data: Array<{ value: number }>) {
  return Math.max(1, ...data.map((entry) => Math.max(entry.value, 0)));
}
