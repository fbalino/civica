"use client";

import { Fragment, type ReactNode, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AtlasCountry } from "@/lib/atlas/load-atlas-data";
import { WORLD_PATHS } from "@/components/atlas/data";
import { buildNeIdMap } from "@/components/atlas/map-geom";
import { useMapPaths } from "@/components/atlas/useMapPaths";

type HrefMode =
  | { type: "atlas"; tab: string }
  | { type: "civica-index" };

export interface ShellCountryRailProps {
  countries: AtlasCountry[];
  /** Current selection, for the highlighted "on" row and mini-map `.sel` class. */
  selectedId: string | null;
  /** Discriminator that tells the rail how to build per-country URLs.
   * Functions can't cross the server→client boundary, so it goes as data. */
  hrefMode: HrefMode;
  /** Top header block — back link, "Pick a country" title, etc. */
  header?: ReactNode;
  /** Optional filter chips rendered between the header and the mini-map. */
  filters?: ReactNode;
}

const REGION_ORDER = ["Americas", "Europe", "Africa", "Asia", "Oceania"];

function buildHref(c: AtlasCountry, mode: HrefMode): string {
  if (mode.type === "atlas") return `/atlas/${c.slug}/${mode.tab}`;
  return `/civica-index/${c.slug}`;
}

/**
 * Shared left-rail component for shell routes that need the legacy Atlas
 * country-picker look — mini-map at top, region-grouped list below, full
 * row highlighted when the slug matches selectedId.
 *
 * Used by `(shell)/@left/atlas/[slug]/[tab]/page.tsx` and
 * `(shell)/@left/civica-index/page.tsx`. Intentionally a client component
 * because the mini-map loads TopoJSON client-side (via useMapPaths) and
 * its paths are router.push-clickable.
 */
export function ShellCountryRail({
  countries,
  selectedId,
  hrefMode,
  header,
  filters,
}: ShellCountryRailProps) {
  const router = useRouter();
  const neIdMap = useMemo(() => buildNeIdMap(countries), [countries]);
  const { mapPaths, mapLoaded } = useMapPaths(
    countries as unknown as Parameters<typeof useMapPaths>[0],
    neIdMap,
  );

  return (
    <div className="chamber-left">
      {header && <div className="left-side-head">{header}</div>}
      {filters}
      <div className="left-mini-map">
        <svg viewBox="0 100 2000 800" preserveAspectRatio="xMidYMid meet">
          {mapLoaded
            ? mapPaths.map((p, i) => (
                <path
                  key={i}
                  d={p.d}
                  data-id={p.id || undefined}
                  className={p.id === selectedId ? "sel" : ""}
                  onClick={() => {
                    if (!p.country) return;
                    const match = countries.find((c) => c.id === p.country!.id);
                    if (match) router.push(buildHref(match, hrefMode));
                  }}
                  style={{ cursor: p.country ? "pointer" : "default" }}
                />
              ))
            : Object.entries(WORLD_PATHS).map(([id, data]) => (
                <path
                  key={id}
                  d={data.d}
                  data-id={id}
                  className={id === selectedId ? "sel" : ""}
                  onClick={() => {
                    const match = countries.find((c) => c.id === id);
                    if (match) router.push(buildHref(match, hrefMode));
                  }}
                  style={{ cursor: "pointer" }}
                />
              ))}
        </svg>
      </div>
      <div className="left-country-list">
        {REGION_ORDER.map((region) => {
          const items = countries.filter((c) => c.region === region);
          if (!items.length) return null;
          return (
            <Fragment key={region}>
              <div className="region-group">
                <div className="region-label">{region}</div>
                {items.map((c) => (
                  <Link
                    key={c.id}
                    href={buildHref(c, hrefMode)}
                    className={`country-row${c.id === selectedId ? " on" : ""}`}
                  >
                    <span>
                      {c.name}
                      {c.featured ? " ★" : ""}
                    </span>
                    <span className="code">{c.id.toUpperCase()}</span>
                  </Link>
                ))}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
