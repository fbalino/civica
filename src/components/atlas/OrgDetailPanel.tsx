"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Country, WORLD_PATHS } from "./data";
import { buildNeIdMap, proj } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import { Reveal } from "@/components/motion/Reveal";
import {
  type OrgDetail,
  ORG_TYPE_COLOR,
  ORG_TYPE_LABEL,
} from "./organizations";
import { SourceDot } from "@/components/SourceDot";
import "@/app/organizations-section.css";

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

  // ATL-012 — dated relationships, not timeless facts: a membership row can
  // be historical (status: "withdrawn"). The stat band, map fill, and
  // regional breakdown all describe the CURRENT footprint; the full roster
  // below (including withdrawn rows) is where the dated history lives.
  const currentMembers = detail.members.filter((m) => m.status !== "withdrawn");
  const formerMembers = detail.members.filter((m) => m.status === "withdrawn");

  const founding = currentMembers.filter(
    (m) => (m.role ?? "").toLowerCase() === "founding",
  ).length;
  const observers = currentMembers.filter(
    (m) => (m.role ?? "").toLowerCase() === "observer",
  ).length;

  const memberIds = new Set(currentMembers.map((m) => m.id));
  const memberBySlug = new Map(detail.members.map((m) => [m.slug, m]));
  const highlightedCount = currentMembers.length;
  const mappedMemberIds = new Set(
    mapLoaded
      ? mapPaths
          .map((p) => p.id)
          .filter((id): id is string => !!id && memberIds.has(id))
      : Object.keys(WORLD_PATHS).filter((id) => memberIds.has(id)),
  );
  const markerMembers = currentMembers
    .filter((m) => !mappedMemberIds.has(m.id) && ORG_MAP_MARKER_COORDS[m.id])
    .map((m) => {
      const [lon, lat] = ORG_MAP_MARKER_COORDS[m.id];
      const [x, y] = proj(lon, lat);
      return { ...m, x, y };
    });

  const regionCounts = new Map<string, number>();
  for (const m of currentMembers) {
    regionCounts.set(m.region, (regionCounts.get(m.region) ?? 0) + 1);
  }
  const regionOrder = ["Americas", "Europe", "Africa", "Asia", "Oceania"];
  const totalMembers = currentMembers.length || 1;

  const foundedLine = o.foundedYear ? `FOUNDED ${o.foundedYear}` : null;
  const hqLine = o.hqCountry ? `HQ ${o.hqCountry.toUpperCase()}` : null;
  const eyebrowTail = [foundedLine, hqLine].filter(Boolean).join(" · ");

  const sortedMembers = [...detail.members].sort(
    (a, b) => (a.joinYear ?? 9999) - (b.joinYear ?? 9999),
  );

  const goToCountry = (slug: string) => {
    if (memberBySlug.get(slug)?.inAtlas) {
      router.push(`/country/${slug}`);
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
          <div className="full">{o.fullName}</div>
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
        <Reveal as="div" className="org-stats" amount={0.4}>
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
          {formerMembers.length > 0 ? (
            <div className="cell">
              <div className="k">Former members</div>
              <div className="v">{formerMembers.length}</div>
            </div>
          ) : (
            <div className="cell">
              <div className="k">Observers shown</div>
              <div className="v">{observers}</div>
            </div>
          )}
        </Reveal>

        <div className="intl-section-head">
          Membership map{" "}
          <span>
            {highlightedCount} of {o.memberCount} members shown in Civica
          </span>
        </div>
        <Reveal as="div" className="intl-panel intl-panel--map" amount={0.2}>
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
        </Reveal>

        <div className="intl-section-head">
          Regional distribution <span>share of shown members</span>
        </div>
        <Reveal
          as="div"
          className="org-region-grid"
          amount={0.3}
          style={
            {
              "--org-region-cols":
                regionOrder.filter((r) => regionCounts.get(r)).length || 1,
            } as CSSProperties
          }
        >
          {regionOrder.map((r) => {
            const ct = regionCounts.get(r);
            if (!ct) return null;
            const pct = Math.round((ct / totalMembers) * 100);
            return (
              <div key={r} className="org-region-card">
                <div className="org-region-label">{r}</div>
                <div className="org-region-value">
                  {ct} <span>&middot; {pct}%</span>
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
        </Reveal>

        <div className="intl-section-head">
          Members{" "}
          <span>
            join year ascending
            {formerMembers.length > 0
              ? ` · ${formerMembers.length} no longer members`
              : ""}
          </span>
        </div>
        <Reveal
          as="div"
          className="intl-mem-list intl-mem-list--org"
          amount={0.1}
        >
          <div className="intl-mem-group">
            {sortedMembers.map((m) => {
              const role = (m.role ?? "").toLowerCase();
              const isP5 = o.type === "un" && role === "permanent";
              // ATL-012 — status/endYear render as an explicit "Withdrawn"
              // badge and a joinYear–endYear range, never silently as a
              // present-tense member.
              const isHistorical = m.status === "withdrawn";
              const badgeParts: string[] = [];
              if (isP5) badgeParts.push("P5");
              else if (m.role) badgeParts.push(m.role);
              if (isHistorical) badgeParts.push("Withdrawn");
              const badgeClass = [
                "role-badge",
                role === "founding" ? "founding" : "",
                isP5 ? "p5" : "",
                role === "observer" ? "observer" : "",
                isHistorical ? "historical" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const yearLabel =
                isHistorical && m.endYear
                  ? `${m.joinYear ?? "—"}–${m.endYear}`
                  : (m.joinYear ?? "—");
              const rowClass = `intl-mem-row${isHistorical ? " intl-mem-row--historical" : ""}`;
              const rowContent = (
                <>
                  <span className="dot" style={{ background: typeVar }} />
                  <span className="name">
                    {m.name}
                    <span className="full">
                      {m.region} &middot; {m.id.toUpperCase()}
                    </span>
                  </span>
                  <span className="year">{yearLabel}</span>
                  {badgeParts.length > 0 ? (
                    <span className={badgeClass}>{badgeParts.join(" · ")}</span>
                  ) : null}
                </>
              );
              return m.inAtlas ? (
                <Link
                  key={m.id}
                  href={`/country/${m.slug}`}
                  className={rowClass}
                >
                  {rowContent}
                </Link>
              ) : (
                <div key={m.id} className={`${rowClass} intl-mem-row--static`}>
                  {rowContent}
                </div>
              );
            })}
          </div>
        </Reveal>

        <div className="org-section-source">
          <SourceDot
            source="civica_organization_roster_v1"
            retrievedAt={detail.membershipSource.retrievedAt}
          />
          <span>
            {detail.membershipSource.coverage === "complete"
              ? "Complete checked roster in this release. "
              : "Selected checked memberships; an absent country is not a non-membership claim. "}
            Source:{" "}
            <a
              href={detail.membershipSource.url}
              target="_blank"
              rel="noreferrer"
            >
              {detail.membershipSource.label}
            </a>
            {" · retrieved "}
            <time dateTime={detail.membershipSource.retrievedAt}>
              July 2026
            </time>
            {" · "}
            {detail.membershipSource.license}.
          </span>
        </div>
      </div>
    </>
  );
}
