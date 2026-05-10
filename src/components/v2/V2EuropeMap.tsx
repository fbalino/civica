"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ISO_NUMERIC_TO_ALPHA3,
  geomToPath,
  proj,
} from "@/components/atlas/map-geom";
import { CountryHoverCard } from "@/components/v2/CountryHoverCard";
import type { EuropeCountryView } from "@/lib/v2/europe-data";

// --- Europe viewport ---
// Equirectangular projection (shared with Civica's existing world map)
// is squished at high latitudes. Acceptable for a preview; tighten the
// viewBox so Europe fills the canvas and Asian Russia is clipped.
const EU_LON_W = -28; // Iceland edge
const EU_LON_E = 50;  // Caspian edge — clips most of Russia
const EU_LAT_N = 72;
const EU_LAT_S = 34;

const TL = proj(EU_LON_W, EU_LAT_N);
const BR = proj(EU_LON_E, EU_LAT_S);
const VB_X = TL[0];
const VB_Y = TL[1];
const VB_W = BR[0] - TL[0];
const VB_H = BR[1] - TL[1];

// Indicator ramp (matches v2.css custom props)
const RAMP = [
  "#EDE4D5",
  "#D2D6DC",
  "#ACC1D2",
  "#6086A8",
  "#1A4970",
];

// Quintile cuts on GDP per capita (USD). Adjusted to spread European
// values: Moldova/Ukraine in the lowest, Western Europe in the highest.
const GDP_BINS = [5_000, 15_000, 30_000, 60_000];

function gdpColor(gdpPerCapita: number | null): string {
  if (gdpPerCapita == null) return "var(--v2-ramp-no-data)";
  for (let i = 0; i < GDP_BINS.length; i++) {
    if (gdpPerCapita < GDP_BINS[i]) return RAMP[i];
  }
  return RAMP[RAMP.length - 1];
}

// Hero image lookup via Wikipedia REST. Keyed by country slug so we
// only fetch each country once per session.
type HeroState = { url: string | null; loading: boolean };
async function fetchHeroImage(name: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return (
      data?.thumbnail?.source ?? data?.originalimage?.source ?? null
    );
  } catch {
    return null;
  }
}

type CountryPath = {
  iso3: string;
  d: string;
  view: EuropeCountryView | null;
  /** Centroid in viewBox coords — used to position the hover card. */
  cx: number;
  cy: number;
};

export function V2EuropeMap({ views }: { views: EuropeCountryView[] }) {
  const [paths, setPaths] = useState<CountryPath[] | null>(null);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [heroByIso, setHeroByIso] = useState<Record<string, HeroState>>({});
  const wrapRef = useRef<HTMLDivElement>(null);

  const viewsByIso3 = useMemo(() => {
    const map = new Map<string, EuropeCountryView>();
    views.forEach((v) => map.set(v.iso3.toLowerCase(), v));
    return map;
  }, [views]);

  // Load TopoJSON once. Same approach as Civica's existing useMapPaths,
  // but we filter to European country paths only and compute centroids.
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
          "https://unpkg.com/world-atlas@2.0.2/countries-50m.json",
        );
        const topo = await resp.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geo = (window as any).topojson.feature(
          topo,
          topo.objects.countries,
        );
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const featPaths: CountryPath[] = geo.features
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((f: any) => {
            const numeric = String(f.id).padStart(3, "0");
            const iso3 = (ISO_NUMERIC_TO_ALPHA3[numeric] ?? "").toLowerCase();
            if (!iso3) return null;
            // Compute a rough centroid in viewBox coords
            const [cx, cy] = roughCentroid(f.geometry);
            const view = viewsByIso3.get(iso3) ?? null;
            return {
              iso3,
              d: geomToPath(f.geometry),
              view,
              cx,
              cy,
            } satisfies CountryPath;
          })
          .filter(Boolean) as CountryPath[];

        // Filter to European countries (those we have a row for) plus
        // a small set of neighbours rendered in "no data" tone for
        // visual continuity.
        const NEIGHBOURS = new Set([
          "mar", "dza", "tun", "lby", "egy", "syr",
          "irq", "irn", "azb", "geo", "arm", "kaz",
        ]);
        const filtered = featPaths.filter(
          (p) =>
            viewsByIso3.has(p.iso3) || NEIGHBOURS.has(p.iso3),
        );

        if (!cancelled) setPaths(filtered);
      } catch {
        if (!cancelled) setPaths([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [viewsByIso3]);

  // Lazy-fetch a hero image when a country is hovered for the first time.
  useEffect(() => {
    if (!hoverIso) return;
    if (heroByIso[hoverIso]) return;
    const view = viewsByIso3.get(hoverIso);
    if (!view) return;
    setHeroByIso((s) => ({ ...s, [hoverIso]: { url: null, loading: true } }));
    fetchHeroImage(view.name).then((url) => {
      setHeroByIso((s) => ({ ...s, [hoverIso]: { url, loading: false } }));
    });
  }, [hoverIso, heroByIso, viewsByIso3]);

  const hoveredPath = useMemo(
    () => paths?.find((p) => p.iso3 === hoverIso) ?? null,
    [paths, hoverIso],
  );
  const hoveredView = hoveredPath?.view ?? null;

  return (
    <div className="v2-map" ref={wrapRef}>
      <div className="v2-map__corner">
        <span>Europe</span>
        <span className="v2-map__corner-rule" />
        <span>GDP per Capita</span>
      </div>
      <div className="v2-map__coords">
        48.8566° N · 2.3522° E
      </div>

      <svg
        className="v2-map__svg"
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Europe choropleth — GDP per capita"
      >
        <g>
          {paths?.map((p) => {
            const isOut = !viewsByIso3.has(p.iso3);
            return (
              <path
                key={p.iso3}
                d={p.d}
                className={`v2-map__country${isOut ? " v2-map__country--out" : ""}${p.iso3 === hoverIso ? " v2-map__country--active" : ""}`}
                fill={isOut ? "var(--v2-ramp-no-data)" : gdpColor(p.view?.gdpPerCapita ?? null)}
                onMouseEnter={() => !isOut && setHoverIso(p.iso3)}
                onMouseLeave={() => setHoverIso((cur) => (cur === p.iso3 ? null : cur))}
              />
            );
          })}
        </g>
      </svg>

      {/* Hover card — anchored to the hovered country's centroid. */}
      {hoveredPath && hoveredView && (
        <div
          className="v2-map__hover-card"
          style={{
            left: `${((hoveredPath.cx - VB_X) / VB_W) * 100}%`,
            top:  `${((hoveredPath.cy - VB_Y) / VB_H) * 100}%`,
          }}
        >
          <CountryHoverCard
            name={hoveredView.name}
            officialName={officialName(hoveredView.name)}
            iso2={hoveredView.iso2 ?? hoveredView.iso3.slice(0, 2)}
            heroImageUrl={
              heroByIso[hoveredView.iso3]?.url ??
              `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 7'%3E%3Crect width='16' height='7' fill='%23E6E1D4'/%3E%3C/svg%3E`
            }
            heroImageAlt={`${hoveredView.name} skyline`}
            stats={[
              {
                label: "Political System",
                value: friendlyGovType(hoveredView.governmentType),
              },
              {
                label: "GDP per Capita",
                value:
                  hoveredView.gdpPerCapita != null
                    ? `$${hoveredView.gdpPerCapita.toLocaleString()}`
                    : "—",
                year: "cache",
              },
              {
                label: "Population",
                value:
                  hoveredView.population != null
                    ? formatPopulation(hoveredView.population)
                    : "—",
                year: "cache",
              },
            ]}
            ctaHref={`/factbook/${hoveredView.slug}`}
          />
        </div>
      )}

      {paths === null && (
        <div className="v2-map__loading">Loading map…</div>
      )}

      {/* Legend */}
      <div className="v2-map__legend">
        <div
          style={{
            fontFamily: "var(--v2-font-display)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--v2-text)",
            marginBottom: 2,
          }}
        >
          GDP per Capita (Nominal)
        </div>
        <div
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: 11,
            color: "var(--v2-text-muted)",
            marginBottom: 10,
            letterSpacing: "0.04em",
          }}
        >
          USD
        </div>
        <div
          style={{
            position: "relative",
            height: 14,
            borderRadius: 4,
            overflow: "hidden",
            background: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[1]} 25%, ${RAMP[2]} 50%, ${RAMP[3]} 75%, ${RAMP[4]})`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "var(--v2-paper-grain)",
              backgroundSize: "180px 180px",
              mixBlendMode: "multiply",
              opacity: 0.65,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--v2-font-body)",
            fontSize: 11,
            color: "var(--v2-text-muted)",
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

// --- helpers ---

function roughCentroid(geom: { type: string; coordinates: unknown }): [number, number] {
  // Walk all polygon rings and average their projected coordinates.
  // Good enough for placing a hover card near each country's middle.
  const rings: number[][][] =
    geom.type === "Polygon"
      ? (geom.coordinates as number[][][])
      : (geom.coordinates as number[][][][]).flat();
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const ring of rings) {
    for (const pt of ring) {
      const [x, y] = proj(pt[0], pt[1]);
      sx += x;
      sy += y;
      n++;
    }
  }
  return n > 0 ? [sx / n, sy / n] : [0, 0];
}

function officialName(name: string): string {
  // Cheap inference for the preview; the real product reads this
  // from `country_facts.official_name`.
  if (name.startsWith("The ")) return name;
  if (/republic|kingdom|federation|union/i.test(name)) return name;
  return `Republic of ${name}`;
}

function friendlyGovType(s: string | null): string {
  if (!s) return "—";
  // Title-case the snake/lowercase values from the cache column.
  return s
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatPopulation(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
