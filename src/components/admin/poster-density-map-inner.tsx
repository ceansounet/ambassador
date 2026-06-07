"use client";

import "leaflet/dist/leaflet.css";
// Registers L.heatLayer (and pins window.L for the plugin) before it's used below.
import "./leaflet-heat";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";

export type PosterMapPoint = {
  id: string;
  lat: number;
  lng: number;
  country: string;
};

export type PosterMapMode = "dots" | "heat";

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
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
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

export default function PosterDensityMapInner({
  points,
  mode = "dots",
}: {
  points: PosterMapPoint[];
  mode?: PosterMapMode;
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
      <FitBounds points={points} />
      {mode === "heat" ? (
        <HeatLayer points={points} color={dotColor} />
      ) : (
        points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={5}
            pathOptions={{
              color: dotColor,
              fillColor: dotColor,
              fillOpacity: 0.45,
              opacity: 0.6,
              weight: 1,
            }}
          />
        ))
      )}
    </MapContainer>
  );
}
