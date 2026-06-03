"use client";

import { Fragment, useEffect, useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { useTranslations } from "next-intl";

import { SHIRT_SIZES, type ShirtStockBySize } from "@/lib/shop";

type WarehouseStatsData = {
  expenditure: {
    contents: number;
    labor: number;
    postage: number;
    total: number;
  };
  sentOrders: number;
  stockBySize: ShirtStockBySize;
};

type PieSlice = {
  name: string;
  value: number;
  fill: string;
};

function isWarehouseStatsData(value: unknown): value is WarehouseStatsData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const expenditure = Reflect.get(value, "expenditure");
  const sentOrders = Reflect.get(value, "sentOrders");
  const stockBySize = Reflect.get(value, "stockBySize");

  return (
    typeof expenditure === "object" &&
    expenditure !== null &&
    typeof Reflect.get(expenditure, "contents") === "number" &&
    typeof Reflect.get(expenditure, "labor") === "number" &&
    typeof Reflect.get(expenditure, "postage") === "number" &&
    typeof Reflect.get(expenditure, "total") === "number" &&
    typeof sentOrders === "number" &&
    typeof stockBySize === "object" &&
    stockBySize !== null &&
    SHIRT_SIZES.every((size) => {
      const stock = Reflect.get(stockBySize, size);

      return typeof stock === "number" || stock === null;
    })
  );
}

export function WarehouseStats({ locale }: { locale: string }) {
  const t = useTranslations("admin.orders.warehouse");
  const [data, setData] = useState<WarehouseStatsData | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch("/api/admin/warehouse-stats", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json() as unknown;
        if (!cancelled && isWarehouseStatsData(result)) {
          setData(result);
        }
      } catch {
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setHasLoaded(true);
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  if (!hasLoaded) {
    return <p className="font-body text-sm text-foreground/50">{t("crunching")}</p>;
  }

  if (data === null) {
    return null;
  }

  const pieData = [
    { name: t("contents"), value: data.expenditure.contents, fill: "var(--chart-applications)" },
    { name: t("labor"), value: data.expenditure.labor, fill: "var(--chart-signups)" },
    { name: t("postage"), value: data.expenditure.postage, fill: "var(--chart-approved)" },
  ];
  const legendItems = [
    { name: t("contents"), value: currencyFmt.format(data.expenditure.contents), fill: "var(--chart-applications)" },
    { name: t("labor"), value: currencyFmt.format(data.expenditure.labor), fill: "var(--chart-signups)" },
    { name: t("postage"), value: currencyFmt.format(data.expenditure.postage), fill: "var(--chart-approved)" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-6 sm:grid-cols-[minmax(16rem,1fr)_auto] sm:items-stretch">
        <div className="min-w-0 flex flex-col gap-3">
          <div>
            <p className="font-body text-sm text-secondary">{t("expenditure-label")}</p>
            <p className="text-2xl text-foreground">{currencyFmt.format(data.expenditure.total)}</p>
          </div>
          <div className="grid grid-cols-[max-content_max-content] gap-x-3 gap-y-2 font-body text-sm text-foreground tabular-nums">
            {legendItems.map((item) => (
              <Fragment key={item.name}>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span>{item.name}</span>
                </div>
                <span className="text-left">
                  {item.value}
                </span>
              </Fragment>
            ))}
          </div>
          <p className="font-body text-xs text-foreground/50">
            {t("sent-orders", { count: data.sentOrders })}
          </p>
        </div>

        <div className="shrink-0 justify-self-start sm:justify-self-end" style={{ width: 160, height: 160 }}>
          <ExpenditurePie data={pieData} locale={locale} />
        </div>
      </div>
    </div>
  );
}

function ExpenditurePie({
  data,
  locale,
}: {
  data: PieSlice[];
  locale: string;
}) {
  const nonZero = data.filter((d) => d.value > 0);
  const hasNonZeroData = nonZero.length > 0;

  return (
    <PieChart width={160} height={160}>
        <Pie
          data={[{ name: "track", value: 1, fill: "var(--border)" }]}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={80}
          strokeWidth={0}
          isAnimationActive={false}
        >
          <Cell fill="var(--border)" />
        </Pie>
        {hasNonZeroData ? (
          <Pie
            data={nonZero}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            strokeWidth={0}
          >
            {nonZero.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        ) : null}
        {hasNonZeroData ? (
          <Tooltip
            content={
              <PieTooltip locale={locale} />
            }
          />
        ) : (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-body text-sm fill-current text-foreground/50"
          >
            0
          </text>
        )}
      </PieChart>
  );
}

function PieTooltip({
  active,
  payload,
  locale,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    payload?: { fill?: string };
  }>;
  locale: string;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  return (
    <div className="border border-foreground/10 bg-card px-4 py-3">
      <div className="space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-body text-sm text-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.payload?.fill ?? "var(--foreground)" }}
              />
              <span>{item.name}</span>
            </div>
            <span className="font-body text-sm text-foreground">
              {currencyFmt.format(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
