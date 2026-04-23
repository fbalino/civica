"use client";

import Link from "next/link";
import type { AtlasCountry } from "@/lib/atlas/load-atlas-data";

const REGION_ORDER = ["Americas", "Europe", "Africa", "Asia", "Oceania"];

export interface AtlasMapLeftProps {
  countries: AtlasCountry[];
}

/**
 * Minimal left rail for the /atlas map root. Region-grouped country
 * list; each row is a Next <Link> so navigation is soft (cached).
 * No mini-map here — the map is the center pane.
 */
export function AtlasMapLeft({ countries }: AtlasMapLeftProps) {
  return (
    <div className="chamber-left">
      <div className="left-side-head">
        <Link
          href="/preview"
          className="back-btn"
          style={{ textDecoration: "none" }}
        >
          ← Back to landing
        </Link>
        <div className="kicker">Atlas</div>
        <div className="title">Pick a country</div>
      </div>
      <div className="left-country-list">
        {REGION_ORDER.map((region) => {
          const items = countries.filter((c) => c.region === region);
          if (!items.length) return null;
          return (
            <div key={region} className="region-group">
              <div className="region-label">{region}</div>
              {items.map((c) => (
                <Link
                  key={c.id}
                  href={`/atlas/${c.slug}/chamber`}
                  className="country-row"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span>
                    {c.name}
                    {c.featured ? " ★" : ""}
                  </span>
                  <span className="code">{c.id.toUpperCase()}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
