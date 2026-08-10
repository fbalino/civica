"use client";

import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { type Country, WORLD_PATHS } from "./data";
import {
  type MapPath,
  geomBBoxArea,
  geomCentroid,
  geomToPath,
} from "./map-geom";

export function buildBundledMapPaths(
  countries: Country[],
  neIdToOurs: Record<string, string>,
): MapPath[] {
  const topology = worldAtlas as unknown as Parameters<typeof feature>[0];
  const geo = feature(topology, topology.objects.countries);
  if (geo.type !== "FeatureCollection") {
    throw new Error("Expected countries to convert to a feature collection");
  }

  return geo.features.map((f) => {
    const geometry = f.geometry as Parameters<typeof geomToPath>[0];
    const neId = String(f.id).padStart(3, "0");
    const ourId = neIdToOurs[neId] || null;
    const country = ourId
      ? countries.find((candidate) => candidate.id === ourId) || null
      : null;
    return {
      d: geomToPath(geometry),
      id: ourId,
      country,
      neId,
      centroid: geomCentroid(geometry, ourId),
      area: geomBBoxArea(geometry),
    };
  });
}

export function buildFallbackMapPaths(countries: Country[]): MapPath[] {
  return Object.entries(WORLD_PATHS).map(([id, data]) => ({
    d: data.d,
    id,
    country: countries.find((candidate) => candidate.id === id) || null,
    neId: "",
    centroid: data.label,
    area: 1000,
  }));
}

/**
 * Converts the bundled world-atlas TopoJSON to SVG paths using our
 * Equirectangular helpers in map-geom.ts, then links each path to a Country by
 * NE_ID lookup. Falls back to the curated WORLD_PATHS set in ./data if the
 * bundled conversion fails.
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
    function load() {
      try {
        const paths = buildBundledMapPaths(countries, neIdToOurs);
        if (cancelled) return;
        setMapPaths(paths);
        setMapLoaded(true);
      } catch {
        const paths = buildFallbackMapPaths(countries);
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
