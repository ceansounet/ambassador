"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";

export type PosterMapPoint = {
  id: string;
  lat: number;
  lng: number;
  country: string;
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
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [map, points]);
  return null;
}

export default function PosterDensityMapInner({ points }: { points: PosterMapPoint[] }) {
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
      {points.map((point) => (
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
      ))}
    </MapContainer>
  );
}
