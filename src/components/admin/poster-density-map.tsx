"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeading } from "@/components/admin/section-heading";
import type { PosterMapDetailsMessages } from "@/components/admin/poster-density-map-inner";
import { cn } from "@/lib/utils";

const PosterDensityMapInner = dynamic(() => import("./poster-density-map-inner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

type PosterMapMode = "dots" | "heat";

export type PosterMapDatum = {
  id: string;
  lat: number;
  lng: number;
  country: string;
  countryName: string;
  state: string;
  isUS: boolean;
  placedBy?: { id: string; name: string };
};

type PosterDensityMapMessages = {
  title: string;
  allCountries: string;
  allStates: string;
  empty: string;
  dots: string;
  heatmap: string;
  // Only needed in "zoom" interaction (the viewer-facing posters map).
  myRegion?: string;
};

export function PosterDensityMap({
  points,
  scope,
  locale,
  messages,
  detailsMessages,
  interaction = "filter",
  myCountry,
}: {
  points: PosterMapDatum[];
  scope: "us" | "all" | "other";
  locale: string;
  messages: PosterDensityMapMessages;
  // When set, dots open a popup with the placer and the poster's address
  // (looked up through the admin-only address endpoint), so only pass it on
  // admin surfaces.
  detailsMessages?: PosterMapDetailsMessages;
  // "filter" (admin) hides every point outside the selection. "zoom" (the
  // viewer-facing map) keeps all dots on screen and instead reframes the map on
  // the selection, so a viewer can never accidentally hide other people's
  // posters. Zoom mode also pins a "My region" entry (the viewer's own country)
  // to the top of the dropdown.
  interaction?: "filter" | "zoom";
  myCountry?: string;
}) {
  const zooming = interaction === "zoom";
  const supportsMyRegion = zooming && myCountry !== undefined && myCountry !== "";
  const defaultSelected = supportsMyRegion ? "myregion" : "all";
  const [selected, setSelected] = useState(defaultSelected);
  const [mode, setMode] = useState<PosterMapMode>("dots");
  // The region scope owns the coarse filter; reset the fine filter whenever it
  // flips so a leftover state/country pick can't hide every point. Done as a
  // during-render adjustment (not an effect) so the reset lands in the same pass.
  const [prevScope, setPrevScope] = useState(scope);
  if (scope !== prevScope) {
    setPrevScope(scope);
    setSelected(defaultSelected);
  }

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

  // In zoom mode every dot stays rendered; the selection only chooses which
  // subset the map reframes onto. An empty subset (e.g. "My region" before the
  // viewer's country has any posters) falls back to framing everything so the
  // map is never left staring at nothing.
  const focusPoints = useMemo(() => {
    if (!zooming) return undefined;
    if (selected === "all") return scopedPoints;
    const key = selected === "myregion" ? myCountry : selected;
    const subset = scopedPoints.filter((point) => point.country === key);
    return subset.length > 0 ? subset : scopedPoints;
  }, [zooming, selected, scopedPoints, myCountry]);

  const renderPoints = zooming ? scopedPoints : filtered;

  const allLabel = usingStates ? messages.allStates : messages.allCountries;

  return (
    <section className="ui-group">
      <SectionHeading title={messages.title}>
        {scopedPoints.length > 0 ? (
          <>
            {/* Segmented dots/heatmap switch, styled like the dashboard view
                toggle: one bordered track, the active half filled solid. */}
            <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-foreground bg-background">
              {([
                { value: "dots", label: messages.dots },
                { value: "heat", label: messages.heatmap },
              ] as const).map((option, index) => {
                const active = option.value === mode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMode(option.value)}
                    className={cn(
                      "flex items-center px-4 py-1.5 font-body text-sm font-bold transition-colors",
                      index > 0 && "border-l border-foreground",
                      active ? "bg-foreground text-white" : "text-foreground hover:bg-foreground/5",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
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
                {supportsMyRegion ? (
                  <SelectItem value="myregion">{messages.myRegion}</SelectItem>
                ) : null}
                <SelectItem value="all">{allLabel}</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label} ({numberFormatter.format(option.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </>
        ) : null}
      </SectionHeading>

      {scopedPoints.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">{messages.empty}</p>
      ) : (
        <div className="isolate h-[28rem] w-full overflow-hidden rounded-xl">
          <PosterDensityMapInner
            points={renderPoints}
            focusPoints={focusPoints}
            mode={mode}
            detailsMessages={detailsMessages}
          />
        </div>
      )}
    </section>
  );
}
