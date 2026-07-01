"use client";

/**
 * CountryMap — the default, free, interactive 2D map for a country, styled to
 * the Civica almanac palette (MapLibre GL + OpenFreeMap vector tiles, recolored
 * at runtime from the live design tokens). Used two ways:
 *   - as a small, non-interactive PREVIEW in the masthead tile, and
 *   - as the large, interactive 2D view inside the Map Explorer modal.
 *
 * MapLibre is dynamically imported so it stays out of the initial page bundle
 * and only loads when this component mounts (client-only; SSR renders an empty
 * framed container). Re-themes automatically when `data-theme` flips.
 */
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  CIVICA_MAP_BASE_STYLE,
  readCivicaMapPalette,
  recolorCivicaMap,
} from "@/lib/map/civica-map-style";
import type { CountryBounds } from "@/lib/data/country-bounds";

interface CountryMapProps {
  bounds: CountryBounds;
  countryName: string;
  /** Enable drag/scroll/zoom handlers. Off for the masthead preview. */
  interactive?: boolean;
  /** Show the zoom control. */
  showControls?: boolean;
  className?: string;
}

export function CountryMap({
  bounds,
  countryName,
  interactive = false,
  showControls = false,
  className,
}: CountryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: CIVICA_MAP_BASE_STYLE,
        bounds: bounds.bbox,
        fitBoundsOptions: { padding: 24, animate: false },
        interactive,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      if (showControls) {
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );
      }

      const applyPalette = () => {
        try {
          recolorCivicaMap(map, readCivicaMapPalette());
        } catch {
          /* base style not ready — the load handler will retry */
        }
      };

      map.on("load", () => {
        if (cancelled) return;
        applyPalette();
      });
      // Swallow tile/network errors (e.g. base source offline) rather than throw.
      map.on("error", () => {});

      observer = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.attributeName === "data-theme") {
            applyPalette();
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
  }, [bounds, interactive, showControls]);

  return (
    <div
      ref={containerRef}
      className={`country-map-canvas${className ? ` ${className}` : ""}`}
      role={interactive ? "application" : "img"}
      aria-label={`Map of ${countryName}`}
    />
  );
}
