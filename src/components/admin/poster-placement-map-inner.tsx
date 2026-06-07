"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";

import type { MapPoster } from "./poster-placement-map";

function markerColor(status: string) {
  if (status === "success") return "#16a34a"; // --acceptance
  if (status === "rejected") return "#ec3750"; // --primary
  return "#000000"; // pending -> --foreground
}

export default function PosterPlacementMapInner({ posters }: { posters: MapPoster[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  useEffect(() => {
    const markers = markersRef.current;
    if (!containerRef.current || posters.length === 0) return;

    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    for (const poster of posters) {
      const marker = L.circleMarker([poster.latitude, poster.longitude], {
        radius: 8,
        color: markerColor(poster.status),
        fillColor: markerColor(poster.status),
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(map);
      marker.bindPopup(escapeHtml(poster.name));
      markers.set(poster.id, marker);
    }

    if (posters.length === 1) {
      map.setView([posters[0].latitude, posters[0].longitude], 14);
    } else {
      map.fitBounds(
        posters.map((p) => [p.latitude, p.longitude]),
        { padding: [40, 40] },
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [posters]);

  function focus(poster: MapPoster) {
    const map = mapRef.current;
    const marker = markersRef.current.get(poster.id);
    if (!map || !marker) return;
    map.flyTo([poster.latitude, poster.longitude], 16, { duration: 0.5 });
    marker.openPopup();
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden border border-foreground/15 bg-muted"
        style={{ zIndex: 0 }}
      />
      <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {posters.map((poster) => (
          <li key={poster.id} className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => focus(poster)}
              className="ui-hover-underline min-w-0 flex-1 truncate text-left font-body text-sm text-foreground"
              title="Zoom to this poster"
            >
              {poster.name}
            </button>
            <a
              href={`https://www.openstreetmap.org/?mlat=${poster.latitude}&mlon=${poster.longitude}#map=17/${poster.latitude}/${poster.longitude}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open in OpenStreetMap"
              title="Open in a new tab"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink size={14} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
