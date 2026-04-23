// Pure projection + geometry helpers for the Atlas world map.
// Shared by AtlasWorldMap and the mini-map inside AtlasCountryLeft.

import type { Country } from "./data";

export const MAP_W = 2000;
export const MAP_H = 1000;
const LAT_MIN = -58;
const LAT_MAX = 85;

export function proj(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return [x, y];
}

type Geometry = {
  type: string;
  coordinates: number[][][][] | number[][][];
};

export function geomToPath(geom: Geometry): string {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  let d = "";
  for (const poly of rings) {
    for (const ring of poly) {
      const pts = ring as number[][];
      let prevLon: number | null = null;
      pts.forEach((pt, i) => {
        const lon = pt[0];
        const lat = pt[1];
        const [x, y] = proj(lon, lat);
        const crossesAntimeridian =
          prevLon !== null && Math.abs(lon - prevLon) > 180;
        if (i === 0 || crossesAntimeridian) {
          d += "M" + x.toFixed(1) + "," + y.toFixed(1);
        } else {
          d += "L" + x.toFixed(1) + "," + y.toFixed(1);
        }
        prevLon = lon;
      });
    }
  }
  return d;
}

export function geomCentroid(geom: Geometry): [number, number] {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  let best: number[][] | null = null;
  let bestArea = 0;
  for (const poly of rings) {
    const ring = poly[0] as number[][];
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    if (w * h > bestArea) {
      bestArea = w * h;
      best = ring;
    }
  }
  if (!best) return [0, 0];
  let sx = 0;
  let sy = 0;
  best.forEach((p) => {
    sx += p[0];
    sy += p[1];
  });
  return proj(sx / best.length, sy / best.length);
}

export function geomBBoxArea(geom: Geometry): number {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  let totalArea = 0;
  for (const poly of rings) {
    const ring = poly[0] as number[][];
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const w = Math.max(...lons) - Math.min(...lons);
    const h = Math.max(...lats) - Math.min(...lats);
    totalArea += w * h;
  }
  return totalArea;
}

export interface MapPath {
  d: string;
  id: string | null;
  country: Country | null;
  neId: string;
  centroid: [number, number];
  area: number;
}
