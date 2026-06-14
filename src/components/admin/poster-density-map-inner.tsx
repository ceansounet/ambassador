"use client";

import "leaflet/dist/leaflet.css";
// Registers L.heatLayer (and pins window.L for the plugin) before it's used below.
import "./leaflet-heat";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";

export type PosterMapPoint = {
  id: string;
  lat: number;
  lng: number;
  country: string;
  // Set for the viewer's own posters: renders the dot more prominently and
  // shows `label` on hover.
  mine?: boolean;
  label?: string;
  placedBy?: { id: string; name: string };
};

export type PosterMapMode = "dots" | "heat";

export type PosterMapDetailsMessages = {
  addressLoading: string;
  addressUnavailable: string;
};

// Pull the brand red from the live token so dots stay inside the palette
// (Leaflet writes colours as SVG values, which don't resolve CSS vars).
function brandColor() {
  if (typeof window === "undefined") return "#ec3750";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  return value || "#ec3750";
}

function FitBounds({ points }: { points: PosterMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    // The map is lazy-loaded, so on first paint its container often hasn't been
    // measured yet and a synchronous fitBounds would fit a zero-size viewport
    // (leaving the default world view until the next interaction). Wait a frame,
    // re-measure, then fit — so "My region" frames on load, not just on reclick.
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    });
    return () => cancelAnimationFrame(frame);
  }, [map, points]);
  return null;
}

// A brand-red heat layer: every point shares the same hue, so density reads
// through accumulated opacity rather than a rainbow ramp — keeping the map inside
// the palette while still pooling into hotspots.
function HeatLayer({ points, color }: { points: PosterMapPoint[]; color: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(
      points.map((point) => [point.lat, point.lng, 1] as [number, number, number]),
      {
        radius: 22,
        blur: 18,
        maxZoom: 11,
        minOpacity: 0.25,
        gradient: { 0.2: color, 0.55: color, 1: color },
      },
    ).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, points, color]);
  return null;
}

// Popup body for one dot: the placer (linked to their admin page) and the
// reverse-geocoded street address. react-leaflet only portals popup children in
// once the popup first opens, so mounting this component is what triggers the
// lazy address lookup; it stays mounted afterwards, caching the result.
function DotDetails({
  point,
  messages,
}: {
  point: PosterMapPoint;
  messages: PosterMapDetailsMessages;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/admin/posters/${point.id}/address`);
        const data: unknown = response.ok ? await response.json() : null;
        const value =
          typeof data === "object" && data !== null && "address" in data && typeof data.address === "string"
            ? data.address
            : null;
        if (cancelled) return;
        if (value !== null) setAddress(value);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [point.id]);

  // Leaflet's popup stylesheet outranks plain utility classes (it colours links
  // and adds paragraph margins), so the overrides here carry !important.
  return (
    <div className="font-body text-sm">
      {point.placedBy !== undefined ? (
        <a
          href={`/admin/users/${point.placedBy.id}`}
          className="font-bold !text-foreground underline"
        >
          {point.placedBy.name}
        </a>
      ) : null}
      <div className={failed ? "text-muted-foreground" : undefined}>
        {failed ? messages.addressUnavailable : address ?? messages.addressLoading}
      </div>
    </div>
  );
}

export default function PosterDensityMapInner({
  points,
  focusPoints,
  mode = "dots",
  detailsMessages,
}: {
  points: PosterMapPoint[];
  // The subset the map reframes onto. Defaults to every point; in zoom mode it
  // tracks the dropdown selection so picking an area flies the map there while
  // every dot stays rendered.
  focusPoints?: PosterMapPoint[];
  mode?: PosterMapMode;
  detailsMessages?: PosterMapDetailsMessages;
}) {
  const dotColor = useMemo(() => brandColor(), []);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      scrollWheelZoom
      worldCopyJump
      className="h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds points={focusPoints ?? points} />
      {mode === "heat" ? (
        <HeatLayer points={points} color={dotColor} />
      ) : (
        // Render the viewer's own dots last so they sit on top of the crowd and
        // stay hoverable where posters overlap.
        [...points]
          .sort((a, b) => (a.mine ? 1 : 0) - (b.mine ? 1 : 0))
          .map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={point.mine ? 7 : 5}
              pathOptions={{
                color: dotColor,
                fillColor: dotColor,
                fillOpacity: point.mine ? 0.95 : 0.45,
                opacity: point.mine ? 1 : 0.6,
                weight: point.mine ? 2 : 1,
              }}
            >
              {point.mine && point.label !== undefined ? (
                <Tooltip direction="top" offset={[0, -4]}>
                  <span className="font-body text-xs">{point.label}</span>
                </Tooltip>
              ) : null}
              {detailsMessages !== undefined ? (
                <Popup>
                  <DotDetails point={point} messages={detailsMessages} />
                </Popup>
              ) : null}
            </CircleMarker>
          ))
      )}
    </MapContainer>
  );
}
