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
  // Set only for the viewer's own posters on the ambassador map: marks the dot
  // so it stands out and carries its label for the hover tooltip.
  mine?: boolean;
  label?: string;
  // Set only on the admin map (for posters that belong to a group), so dots can
  // be filtered by group.
  groupId?: string;
  groupName?: string | null;
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
  // Only needed on the admin map, where dots carry their group: enables the
  // group filter dropdown.
  allGroups?: string;
  untitledGroup?: string;
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
  // Zoom mode always offers "My region" as the default landing view. It doesn't
  // depend on the viewer having a stored country: with one, it frames that
  // country; without, focusPoints falls back to framing everyone, so the label
  // is still honoured rather than silently dropping to "All countries".
  const supportsMyRegion = zooming && messages.myRegion !== undefined;
  const defaultSelected = supportsMyRegion ? "myregion" : "all";
  const [selected, setSelected] = useState(defaultSelected);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [mode, setMode] = useState<PosterMapMode>("dots");
  // The region scope owns the coarse filter; reset the fine filters whenever it
  // flips so a leftover state/country/group pick can't hide every point. Done as
  // a during-render adjustment (not an effect) so the reset lands in the same pass.
  const [prevScope, setPrevScope] = useState(scope);
  if (scope !== prevScope) {
    setPrevScope(scope);
    setSelected(defaultSelected);
    setSelectedGroup("all");
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

  // Resolve a country's display name from its ISO code so the list reads as one
  // consistent set of full names ("India", not "IN") regardless of whether the
  // ambassador's stored country_name was ever filled in. Falls back to the
  // stored name (then the raw code) for non-ISO values like the "XX" unknown.
  const countryLabel = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      display = null;
    }
    return (point: PosterMapDatum) => {
      const code = point.country.toUpperCase();
      if (display !== null && /^[A-Z]{2}$/.test(code)) {
        try {
          const name = display.of(code);
          if (name !== undefined && name !== code) return name;
        } catch {
          // not a recognised region code; fall through
        }
      }
      return point.countryName || point.country;
    };
  }, [locale]);

  const options = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const point of scopedPoints) {
      const key = usingStates ? point.state : point.country;
      const label = usingStates ? point.state : countryLabel(point);
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { key, label, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [scopedPoints, usingStates, countryLabel]);

  // The group filter is admin-only (the ambassador map never carries other
  // people's groups, so groupId is absent there). List every group that has a
  // dot in scope, busiest first, mirroring the country dropdown.
  const groupOptions = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const point of scopedPoints) {
      if (point.groupId === undefined) continue;
      const existing = counts.get(point.groupId);
      if (existing) existing.count += 1;
      else
        counts.set(point.groupId, {
          key: point.groupId,
          label: point.groupName?.trim() || (messages.untitledGroup ?? "Untitled group"),
          count: 1,
        });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [scopedPoints, messages.untitledGroup]);

  const supportsGroups = messages.allGroups !== undefined && groupOptions.length > 0;

  const filtered = useMemo(() => {
    const byRegion =
      selected === "all"
        ? scopedPoints
        : scopedPoints.filter(
            (point) => (usingStates ? point.state : point.country) === selected,
          );
    return selectedGroup === "all"
      ? byRegion
      : byRegion.filter((point) => point.groupId === selectedGroup);
  }, [scopedPoints, selected, usingStates, selectedGroup]);

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
            {supportsGroups ? (
              <div className="w-full sm:w-64">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger
                    size="sm"
                    className="ui-input-surface !bg-muted w-full !rounded-none border-0 px-3 text-sm focus-visible:ring-foreground/15 aria-[invalid]:!border-transparent aria-[invalid]:!ring-0"
                  >
                    <SelectValue placeholder={messages.allGroups} />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    position="popper"
                    className="w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width)"
                  >
                    <SelectItem value="all">{messages.allGroups}</SelectItem>
                    {groupOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label} ({numberFormatter.format(option.count)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
