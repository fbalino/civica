"use client";

/**
 * CountryMap — the default, free, interactive 2D map for a country, styled to
 * the Civica almanac palette (MapLibre GL, recolored at runtime from the live
 * design tokens). Used two ways:
 *   - as a small, non-interactive PREVIEW in the masthead tile, and
 *   - as the large, interactive 2D view inside the Map Explorer modal.
 *
 * Two tile back-ends, chosen at runtime (see civica-map-style.ts):
 *   - SELF-HOSTED Protomaps `.pmtiles` on Vercel Blob (when
 *     `NEXT_PUBLIC_BASEMAP_PMTILES_URL` is set) — read client-side over HTTP
 *     range requests via the `pmtiles` protocol; the style is pre-colored to the
 *     Civica palette by `buildCivicaPmtilesStyle`.
 *   - OpenFreeMap positron (fallback) — recolored in place by `recolorCivicaMap`.
 *
 * MapLibre and the pmtiles protocol are dynamically imported so they stay out of
 * the initial page bundle and only load when this component mounts (client-only;
 * SSR renders an empty framed container). Re-themes automatically when
 * `data-theme` flips.
 */
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  CIVICA_MAP_BASE_STYLE,
  CIVICA_PMTILES_MAX_ZOOM,
  buildCivicaPmtilesStyle,
  isPmtilesEnabled,
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

type MapLibreModule = typeof import("maplibre-gl");

// The pmtiles protocol only needs to be registered once per page load.
let pmtilesProtocolRegistered = false;
async function ensurePmtilesProtocol(
  maplibregl: MapLibreModule,
): Promise<void> {
  if (pmtilesProtocolRegistered) return;
  const { Protocol } = await import("pmtiles");
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  pmtilesProtocolRegistered = true;
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
    const selfHosted = isPmtilesEnabled();

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";

      // Self-hosted path: register the pmtiles protocol and build the pre-colored
      // style. Fallback path: point at OpenFreeMap and recolor after load.
      let style: string | Awaited<ReturnType<typeof buildCivicaPmtilesStyle>> =
        CIVICA_MAP_BASE_STYLE;
      if (selfHosted) {
        try {
          await ensurePmtilesProtocol(maplibregl);
          style = await buildCivicaPmtilesStyle(
            readCivicaMapPalette(isDark),
            isDark,
          );
        } catch {
          // If the self-hosted style can't be built, degrade to OpenFreeMap.
          style = CIVICA_MAP_BASE_STYLE;
        }
      }
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        bounds: bounds.bbox,
        fitBoundsOptions: { padding: 24, animate: false },
        // Cap max zoom in the self-hosted path so users never zoom past the
        // extract's z9 base into blur (~2 levels of vector overzoom stays crisp).
        maxZoom: selfHosted ? CIVICA_PMTILES_MAX_ZOOM : undefined,
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

      // Self-hosted styles are pre-colored, so only the OpenFreeMap fallback
      // needs the in-place recolor.
      const applyPalette = () => {
        if (selfHosted) return;
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
            if (selfHosted) {
              // Recolor for the new theme. The layer structure is identical
              // across themes (only colors change), so `diff: true` lets
              // MapLibre update paint properties in place — no source re-init,
              // no blank flash while the pmtiles source reloads.
              const dark =
                document.documentElement.getAttribute("data-theme") === "dark";
              buildCivicaPmtilesStyle(readCivicaMapPalette(dark), dark)
                .then((next) => {
                  if (!cancelled) map.setStyle(next, { diff: true });
                })
                .catch(() => {});
            } else {
              applyPalette();
            }
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
