"use client";

/**
 * Country3DView — the on-demand Mapbox 3D/globe map (the "3D" side of the Map
 * Explorer). Mapbox is the one paid tile source, so it's dynamically imported
 * and only ever mounts when the user switches to 3D inside the modal — keeping
 * Mapbox loads minimal (comfortably inside the free tier). Uses the Standard
 * style (3D buildings, terrain, globe) with day/night lighting tied to the
 * site theme. Requires `NEXT_PUBLIC_MAPBOX_TOKEN`; degrades to a notice if
 * absent.
 */
import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import type { CountryBounds } from "@/lib/data/country-bounds";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const isDark = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

interface Country3DViewProps {
  bounds: CountryBounds;
  countryName: string;
}

export function Country3DView({ bounds, countryName }: Country3DViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [pitched, setPitched] = useState(true);
  const [globe, setGlobe] = useState(false);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    let cancelled = false;
    let observer: MutationObserver | null = null;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        bounds: bounds.bbox,
        fitBoundsOptions: { padding: 40, pitch: 55 },
      });
      mapRef.current = map;
      map.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );

      const applyLight = () => {
        try {
          map.setConfigProperty(
            "basemap",
            "lightPreset",
            isDark() ? "night" : "day",
          );
        } catch {
          /* config not ready */
        }
      };
      map.on("style.load", applyLight);
      map.on("error", () => {});

      observer = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.attributeName === "data-theme") {
            applyLight();
            break;
          }
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      try {
        mapRef.current?.remove();
      } catch {
        /* already torn down */
      }
      mapRef.current = null;
    };
  }, [bounds]);

  const toggleTilt = () => {
    const m = mapRef.current;
    if (!m) return;
    const next = !pitched;
    setPitched(next);
    m.easeTo({ pitch: next ? 55 : 0, duration: 700 });
  };
  const toggleGlobe = () => {
    const m = mapRef.current;
    if (!m) return;
    const next = !globe;
    setGlobe(next);
    m.setProjection(next ? "globe" : "mercator");
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="country-map-canvas country-3d-missing">
        3D view is unavailable — a Mapbox token isn&apos;t configured.
      </div>
    );
  }

  return (
    <div className="country-3d-wrap">
      <div
        ref={containerRef}
        className="country-map-canvas"
        role="application"
        aria-label={`3D map of ${countryName}`}
      />
      <div className="country-3d-controls">
        <button
          type="button"
          className="country-map-mini-btn"
          aria-pressed={pitched}
          onClick={toggleTilt}
        >
          Tilt 3D
        </button>
        <button
          type="button"
          className="country-map-mini-btn"
          aria-pressed={globe}
          onClick={toggleGlobe}
        >
          Globe
        </button>
      </div>
    </div>
  );
}
