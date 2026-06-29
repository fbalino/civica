"use client";

import { useEffect, useState } from "react";
import { type Country, WORLD_PATHS } from "./data";
import {
  type MapPath,
  geomBBoxArea,
  geomCentroid,
  geomToPath,
} from "./map-geom";

/**
 * Loads the world-atlas TopoJSON via unpkg, projects each feature to an
 * SVG path using our Equirectangular helpers in map-geom.ts, and links
 * each path to a Country by NE_ID lookup. Falls back to the curated
 * WORLD_PATHS set in ./data if the CDN fetch fails offline.
 *
 * Used by both AtlasApp (legacy /) and the standalone (reader)/atlas pages.
 */
export function useMapPaths(
  countries: Country[],
  neIdToOurs: Record<string, string>,
): { mapPaths: MapPath[]; mapLoaded: boolean } {
  const [mapPaths, setMapPaths] = useState<MapPath[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const script = document.createElement("script");
        script.src =
          "https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js";
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
        const resp = await fetch(
          "https://unpkg.com/world-atlas@2.0.2/countries-110m.json",
        );
        const topo = await resp.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geo = (window as any).topojson.feature(
          topo,
          topo.objects.countries,
        );
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paths: MapPath[] = geo.features.map((f: any) => {
          const neId = String(f.id).padStart(3, "0");
          const ourId = neIdToOurs[neId] || null;
          const c = ourId
            ? countries.find((cc) => cc.id === ourId) || null
            : null;
          return {
            d: geomToPath(f.geometry),
            id: ourId,
            country: c,
            neId,
            centroid: geomCentroid(f.geometry),
            area: geomBBoxArea(f.geometry),
          };
        });
        setMapPaths(paths);
        setMapLoaded(true);
      } catch {
        const paths = Object.entries(WORLD_PATHS).map(([id, data]) => {
          const c = countries.find((cc) => cc.id === id) || null;
          return {
            d: data.d,
            id,
            country: c,
            neId: "",
            centroid: data.label as [number, number],
            area: 1000,
          };
        });
        if (!cancelled) {
          setMapPaths(paths);
          setMapLoaded(true);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [countries, neIdToOurs]);

  return { mapPaths, mapLoaded };
}
