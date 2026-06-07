"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeading } from "@/components/admin/section-heading";

const PosterDensityMapInner = dynamic(() => import("./poster-density-map-inner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export type PosterMapDatum = {
  id: string;
  lat: number;
  lng: number;
  country: string;
  countryName: string;
  state: string;
  isUS: boolean;
};

type PosterDensityMapMessages = {
  title: string;
  allCountries: string;
  allStates: string;
  empty: string;
};

export function PosterDensityMap({
  points,
  scope,
  locale,
  messages,
}: {
  points: PosterMapDatum[];
  scope: "us" | "all" | "other";
  locale: string;
  messages: PosterDensityMapMessages;
}) {
  const [selected, setSelected] = useState("all");
  // The region scope owns the coarse filter; reset the fine filter whenever it
  // flips so a leftover state/country pick can't hide every point.
  useEffect(() => {
    setSelected("all");
  }, [scope]);

  // The US scope drills into states; the others group by country. "other" never
  // includes the US, which its scoped points already exclude.
  const usingStates = scope === "us";

  const scopedPoints = useMemo(() => {
    if (scope === "us") return points.filter((point) => point.isUS);
    if (scope === "other") return points.filter((point) => !point.isUS);
    return points;
  }, [points, scope]);

  const numberFormatter = new Intl.NumberFormat(locale);

  const options = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const point of scopedPoints) {
      const key = usingStates ? point.state : point.country;
      const label = usingStates ? point.state : point.countryName;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { key, label, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [scopedPoints, usingStates]);

  const filtered = useMemo(
    () =>
      selected === "all"
        ? scopedPoints
        : scopedPoints.filter(
            (point) => (usingStates ? point.state : point.country) === selected,
          ),
    [scopedPoints, selected, usingStates],
  );

  const allLabel = usingStates ? messages.allStates : messages.allCountries;

  return (
    <section className="ui-group">
      <SectionHeading title={messages.title}>
        {scopedPoints.length > 0 ? (
          <div className="w-full sm:w-64">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger
                size="sm"
                className="ui-input-surface !bg-muted w-full !rounded-none border-0 px-3 text-sm focus-visible:ring-foreground/15 aria-[invalid]:!border-transparent aria-[invalid]:!ring-0"
              >
                <SelectValue placeholder={allLabel} />
              </SelectTrigger>
              <SelectContent
                align="end"
                position="popper"
                className="w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width)"
              >
                <SelectItem value="all">{allLabel}</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label} ({numberFormatter.format(option.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </SectionHeading>

      {scopedPoints.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">{messages.empty}</p>
      ) : (
        <div className="isolate h-[28rem] w-full overflow-hidden rounded-xl">
          <PosterDensityMapInner points={filtered} />
        </div>
      )}
    </section>
  );
}
