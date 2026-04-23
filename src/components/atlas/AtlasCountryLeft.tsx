"use client";

import { type Country, WORLD_PATHS } from "./data";
import type { MapPath } from "./map-geom";
import type { OrgGroup } from "./organizations";

type LeftMode = "countries" | "organizations";

export interface AtlasCountryLeftProps {
  countries: Country[];
  mapPaths: MapPath[];
  mapLoaded: boolean;
  /** Current country selection, for the highlighted "on" row + mini-map `.sel` class. */
  selectedCountry: Country | null;
  leftMode: LeftMode;
  orgGroups: OrgGroup[] | null;
  orgGroupsLoading: boolean;
  selectedOrgSlug: string | null;
  mobilePanelVisible: boolean;
  onBackToAtlas: () => void;
  onLeftModeChange: (m: LeftMode) => void;
  onPickCountry: (c: Country) => void;
  onPickOrg: (slug: string) => void;
}

const REGION_ORDER = ["Americas", "Europe", "Africa", "Asia", "Oceania"];

export function AtlasCountryLeft({
  countries,
  mapPaths,
  mapLoaded,
  selectedCountry,
  leftMode,
  orgGroups,
  orgGroupsLoading,
  selectedOrgSlug,
  mobilePanelVisible,
  onBackToAtlas,
  onLeftModeChange,
  onPickCountry,
  onPickOrg,
}: AtlasCountryLeftProps) {
  const selectedId = selectedCountry?.id ?? null;

  return (
    <div className={`chamber-left${mobilePanelVisible ? " mobile-visible" : ""}`}>
      <div className="left-side-head">
        <button className="back-btn" onClick={onBackToAtlas}>
          &larr; Back to full atlas
        </button>
        <div className="kicker">Atlas</div>
        <div className="title">
          {leftMode === "countries" ? "Pick a country" : "Pick an organization"}
        </div>
        <div className="left-mode-toggle" style={{ marginTop: 10 }}>
          <button
            className={leftMode === "countries" ? "on" : ""}
            onClick={() => onLeftModeChange("countries")}
          >
            Countries
          </button>
          <button
            className={leftMode === "organizations" ? "on" : ""}
            onClick={() => onLeftModeChange("organizations")}
          >
            Organizations
          </button>
        </div>
      </div>

      {leftMode === "countries" && (
        <>
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
                        if (p.country) onPickCountry(p.country);
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
                        const c = countries.find((c) => c.id === id);
                        if (c) onPickCountry(c);
                      }}
                    />
                  ))}
            </svg>
          </div>
          <div className="left-country-list">
            {REGION_ORDER.map((region) => {
              const items = countries.filter((c) => c.region === region);
              if (!items.length) return null;
              return (
                <div key={region} className="region-group">
                  <div className="region-label">{region}</div>
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className={`country-row${c.id === selectedId ? " on" : ""}`}
                      onClick={() => onPickCountry(c)}
                    >
                      <span>
                        {c.name}
                        {c.featured ? " ★" : ""}
                      </span>
                      <span className="code">{c.id.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {leftMode === "organizations" && (
        <div className="left-org-list">
          {orgGroupsLoading && !orgGroups ? (
            <div
              className="atlas-mono"
              style={{
                fontSize: 11,
                color: "var(--atlas-muted)",
                padding: "30px 10px",
                textAlign: "center",
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              Loading&hellip;
            </div>
          ) : orgGroups && orgGroups.length > 0 ? (
            orgGroups.map((g) => (
              <div key={g.type} className="type-group">
                <div className="type-label" style={{ color: g.color }}>
                  {g.label}
                </div>
                {g.organizations.map((o) => {
                  const initials = o.name.length <= 4 ? o.name : o.name.slice(0, 3);
                  return (
                    <div
                      key={o.id}
                      className={`org-row${selectedOrgSlug === o.slug ? " on" : ""}`}
                      onClick={() => onPickOrg(o.slug)}
                    >
                      <span className="initials" style={{ background: g.color }}>
                        {initials}
                      </span>
                      <span className="nm">{o.name}</span>
                      <span className="count">{o.memberCount}</span>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div
              className="atlas-mono"
              style={{
                fontSize: 11,
                color: "var(--atlas-muted)",
                padding: "30px 10px",
                textAlign: "center",
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              No data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
