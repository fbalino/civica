"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Country, WORLD_PATHS } from "./data";
import { buildNeIdMap, proj } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import {
  type OrgDetail,
  ORG_TYPE_COLOR,
  ORG_TYPE_LABEL,
} from "./organizations";

const ORG_MAP_MARKER_COORDS: Record<string, [number, number]> = {
  and: [1.52, 42.51],
  atg: [-61.8, 17.06],
  are: [54.3, 24.4],
  aze: [47.58, 40.14],
  bhr: [50.55, 26.07],
  brb: [-59.54, 13.19],
  caf: [20.94, 6.61],
  cpv: [-23.62, 15.12],
  com: [43.33, -11.65],
  cyp: [33.43, 35.13],
  esh: [-12.89, 24.22],
  grd: [-61.68, 12.12],
  gnb: [-15.18, 11.8],
  lbn: [35.86, 33.85],
  lie: [9.55, 47.16],
  lux: [6.13, 49.82],
  mco: [7.42, 43.74],
  mlt: [14.38, 35.94],
  mus: [57.55, -20.2],
  pse: [35.2, 31.9],
  qat: [51.18, 25.35],
  smr: [12.46, 43.94],
  sgp: [103.82, 1.35],
  stp: [6.61, 0.19],
  syc: [55.45, -4.68],
  swz: [31.47, -26.52],
};

/**
 * Phase A.5 — Organization detail view, recovered from the deleted
 * AtlasApp.tsx (commit df32da9^). Renders a masthead, member stats,
 * a world map with member countries highlighted in the organization
 * type's color, regional distribution bars, and a sortable member
 * list. Lives at /atlas/organizations/[slug] inside the shell.
 */
export function OrgDetailPanel({
  detail,
  countries,
}: {
  detail: OrgDetail;
  countries: Country[];
}) {
  const router = useRouter();
  const neIdMap = useMemo(() => buildNeIdMap(countries), [countries]);
  const { mapPaths, mapLoaded } = useMapPaths(countries, neIdMap);

  const o = detail.organization;
  const typeVar = ORG_TYPE_COLOR[o.type];
  const typeLabel = ORG_TYPE_LABEL[o.type];

  const founding = detail.members.filter(
    (m) => (m.role ?? "").toLowerCase() === "founding",
  ).length;
  const observers = detail.members.filter(
    (m) => (m.role ?? "").toLowerCase() === "observer",
  ).length;

  const memberIds = new Set(detail.members.map((m) => m.id));
  const memberBySlug = new Map(detail.members.map((m) => [m.slug, m]));
  const highlightedCount = detail.members.length;
  const mappedMemberIds = new Set(
    mapLoaded
      ? mapPaths
          .map((p) => p.id)
          .filter((id): id is string => !!id && memberIds.has(id))
      : Object.keys(WORLD_PATHS).filter((id) => memberIds.has(id)),
  );
  const markerMembers = detail.members
    .filter((m) => !mappedMemberIds.has(m.id) && ORG_MAP_MARKER_COORDS[m.id])
    .map((m) => {
      const [lon, lat] = ORG_MAP_MARKER_COORDS[m.id];
      const [x, y] = proj(lon, lat);
      return { ...m, x, y };
    });

  const regionCounts = new Map<string, number>();
  for (const m of detail.members) {
    regionCounts.set(m.region, (regionCounts.get(m.region) ?? 0) + 1);
  }
  const regionOrder = ["Americas", "Europe", "Africa", "Asia", "Oceania"];
  const totalMembers = detail.members.length || 1;

  const foundedLine = o.foundedYear ? `FOUNDED ${o.foundedYear}` : null;
  const hqLine = o.hqCountry ? `HQ ${o.hqCountry.toUpperCase()}` : null;
  const eyebrowTail = [foundedLine, hqLine].filter(Boolean).join(" · ");

  const sortedMembers = [...detail.members].sort(
    (a, b) => (a.joinYear ?? 9999) - (b.joinYear ?? 9999),
  );

  const goToCountry = (slug: string) => {
    if (memberBySlug.get(slug)?.inAtlas) {
      router.push(`/factbook/${slug}`);
    }
  };

  return (
    <>
      <div
        className="org-masthead"
        style={{ "--org-color": typeVar } as CSSProperties}
      >
        <div className="badge" aria-hidden="true">
          {o.name.slice(0, 3)}
        </div>
        <div>
          <div className="eyebrow">
            {typeLabel.toUpperCase()} &middot; {o.slug.toUpperCase()}
            {eyebrowTail ? <> &middot; {eyebrowTail}</> : null}
          </div>
          <h1>{o.name}</h1>
          <div className="full">
            {o.fullName}
          </div>
          {o.description ? <div className="desc">{o.description}</div> : null}
          <div className="org-masthead-chips">
            <span className="type-chip">
              <span className="dot" />
              {typeLabel}
            </span>
          </div>
        </div>
        <div className="founded">
          {o.foundedYear ? (
            <>
              Founded
              <b>{o.foundedYear}</b>
            </>
          ) : null}
          {o.hqCountry ? <span>HQ {o.hqCountry.toUpperCase()}</span> : null}
        </div>
      </div>

      <div className="org-detail-content">
        <div className="org-stats">
          <div className="cell">
            <div className="k">Members</div>
            <div className="v">{o.memberCount}</div>
          </div>
          <div className="cell">
            <div className="k">Shown in Atlas</div>
            <div className="v">{highlightedCount}</div>
          </div>
          <div className="cell">
            <div className="k">Founding shown</div>
            <div className="v">{founding}</div>
          </div>
          <div className="cell">
            <div className="k">Observers shown</div>
            <div className="v">{observers}</div>
          </div>
        </div>

        <div className="intl-section-head">
          Membership map{" "}
          <span>
            {highlightedCount} of {o.memberCount} members shown in Civica
          </span>
        </div>
        <div className="intl-panel intl-panel--map">
          <svg
            viewBox="0 100 2000 800"
            preserveAspectRatio="xMidYMid meet"
            className="org-mini-map"
          >
          {mapLoaded
            ? mapPaths.map((p, i) => {
                const isMember = !!(p.id && memberIds.has(p.id));
                return (
                  <path
                    key={i}
                    d={p.d}
                    data-id={p.id || undefined}
                    className={isMember ? "member" : ""}
                    style={{
                      fill: isMember ? typeVar : "var(--atlas-paper-3)",
                      stroke: "var(--atlas-paper)",
                      strokeWidth: 0.6,
                      opacity: isMember ? 0.9 : 0.4,
                      cursor: isMember && p.id ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (isMember && p.id) {
                        const m = detail.members.find((mm) => mm.id === p.id);
                        if (m) goToCountry(m.slug);
                      }
                    }}
                  />
                );
              })
            : Object.entries(WORLD_PATHS).map(([id, data]) => {
                const isMember = memberIds.has(id);
                return (
                  <path
                    key={id}
                    d={data.d}
                    style={{
                      fill: isMember ? typeVar : "var(--atlas-paper-3)",
                      stroke: "var(--atlas-paper)",
                      strokeWidth: 0.6,
                      opacity: isMember ? 0.9 : 0.4,
                      cursor: isMember ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (isMember) {
                        const m = detail.members.find((mm) => mm.id === id);
                        if (m) goToCountry(m.slug);
                      }
                    }}
                  />
                );
              })}
          <g className="org-map-markers" aria-hidden="true">
            {markerMembers.map((m) => (
              <circle
                key={m.id}
                data-id={m.id}
                cx={m.x}
                cy={m.y}
                r={8}
                className="member-marker"
                style={{
                  fill: typeVar,
                  stroke: "var(--atlas-paper)",
                  strokeWidth: 3,
                  cursor: m.inAtlas ? "pointer" : "default",
                }}
                onClick={() => {
                  if (m.inAtlas) goToCountry(m.slug);
                }}
              />
            ))}
          </g>
          </svg>
        </div>

        <div className="intl-section-head">
          Regional distribution <span>share of shown members</span>
        </div>
        <div
          className="org-region-grid"
          style={{
            "--org-region-cols":
              regionOrder.filter((r) => regionCounts.get(r)).length || 1,
          } as CSSProperties}
        >
        {regionOrder.map((r) => {
          const ct = regionCounts.get(r);
          if (!ct) return null;
          const pct = Math.round((ct / totalMembers) * 100);
          return (
            <div key={r} className="org-region-card">
              <div className="org-region-label">
                {r}
              </div>
              <div className="org-region-value">
                {ct}{" "}
                <span>
                  &middot; {pct}%
                </span>
              </div>
              <div className="org-region-bar">
                <div
                  style={{
                    width: `${pct}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
        </div>

        <div className="intl-section-head">
          Members <span>join year ascending</span>
        </div>
        <div className="intl-mem-list intl-mem-list--org">
          <div className="intl-mem-group">
            {sortedMembers.map((m) => {
            const role = (m.role ?? "").toLowerCase();
            const isP5 = o.type === "un" && role === "permanent";
            const badgeClass =
              role === "founding"
                ? "role-badge founding"
                : isP5
                  ? "role-badge p5"
                  : role === "observer"
                    ? "role-badge observer"
                    : role
                      ? "role-badge"
                      : "";
            const rowContent = (
              <>
                <span className="dot" style={{ background: typeVar }} />
                <span className="name">
                  {m.name}
                  <span className="full">
                    {m.region} &middot; {m.id.toUpperCase()}
                  </span>
                </span>
                <span className="year">{m.joinYear ?? "—"}</span>
                {m.role ? (
                  <span className={badgeClass}>{isP5 ? "P5" : m.role}</span>
                ) : null}
              </>
            );
            return m.inAtlas ? (
              <Link
                key={m.id}
                href={`/atlas/${m.slug}/structure`}
                className="intl-mem-row"
              >
                {rowContent}
              </Link>
            ) : (
              <div
                key={m.id}
                className="intl-mem-row intl-mem-row--static"
              >
                {rowContent}
              </div>
            );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
