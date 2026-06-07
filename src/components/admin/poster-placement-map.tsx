"use client";

import dynamic from "next/dynamic";

export type MapPoster = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
};

// Leaflet is bundled (not pulled from a CDN at runtime) and only ever touches
// the DOM, so it loads client-side only.
const PosterPlacementMapInner = dynamic(() => import("./poster-placement-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse border border-foreground/15 bg-muted" />
  ),
});

export function PosterPlacementMap({ posters }: { posters: MapPoster[] }) {
  return <PosterPlacementMapInner posters={posters} />;
}
