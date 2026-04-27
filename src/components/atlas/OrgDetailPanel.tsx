"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Country, WORLD_PATHS } from "./data";
import { buildNeIdMap } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import {
  type OrgDetail,
  ORG_TYPE_COLOR,
  ORG_TYPE_LABEL,
} from "./organizations";

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
    if (memberBySlug.has(slug)) {
      router.push(`/atlas/${slug}/chamber`);
    }
  };

  return (
    <>
      <div className="atlas-masthead">
        <div>
          <div className="eyebrow">
            {typeLabel.toUpperCase()} &middot; {o.slug.toUpperCase()}
            {eyebrowTail ? <> &middot; {eyebrowTail}</> : null}
          </div>
          <h1>{o.name}</h1>
          <div className="dek">
            {o.fullName}
            {o.description ? <> &mdash; {o.description}</> : null}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              className="atlas-mono"
              style={{
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                padding: "3px 9px",
                border: `1px solid ${typeVar}`,
                color: typeVar,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: typeVar,
                }}
              />
              {typeLabel}
            </span>
          </div>
        </div>
        <div className="quick-facts">
          <div className="r">
            <b>Members</b>
            <span>{detail.members.length}</span>
          </div>
          <div className="r">
            <b>Founding</b>
            <span>{founding}</span>
          </div>
          <div className="r">
            <b>Observers</b>
            <span>{observers}</span>
          </div>
          {o.foundedYear ? (
            <div className="r">
              <b>Founded</b>
              <span>{o.foundedYear}</span>
            </div>
          ) : null}
          {o.hqCountry ? (
            <div className="r">
              <b>HQ</b>
              <span>{o.hqCountry.toUpperCase()}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="org-stats">
        <div className="cell">
          <div className="k">Members</div>
          <div className="v">{detail.members.length}</div>
        </div>
        <div className="cell">
          <div className="k">Founding members</div>
          <div className="v">{founding}</div>
        </div>
        <div className="cell">
          <div className="k">Observers</div>
          <div className="v">{observers}</div>
        </div>
        <div className="cell">
          <div className="k">HQ</div>
          <div className="v" style={{ fontSize: 14 }}>
            {o.hqCountry ? o.hqCountry.toUpperCase() : "—"}
          </div>
        </div>
      </div>

      <div className="intl-section-head">
        Membership map{" "}
        <span>{detail.members.length} countries highlighted</span>
      </div>
      <div className="intl-panel" style={{ padding: 8 }}>
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
        </svg>
      </div>

      <div className="intl-section-head">
        Regional distribution <span>share of membership</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${regionOrder.filter((r) => regionCounts.get(r)).length || 1}, 1fr)`,
          gap: 8,
          margin: "8px 0 4px",
        }}
      >
        {regionOrder.map((r) => {
          const ct = regionCounts.get(r);
          if (!ct) return null;
          const pct = Math.round((ct / totalMembers) * 100);
          return (
            <div
              key={r}
              style={{
                border: "1px solid var(--atlas-rule-2)",
                padding: "10px 12px",
                background: "var(--atlas-paper-2)",
              }}
            >
              <div
                className="atlas-mono"
                style={{
                  fontSize: 10,
                  color: "var(--atlas-muted)",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                }}
              >
                {r}
              </div>
              <div
                className="atlas-serif"
                style={{
                  fontSize: 20,
                  letterSpacing: "-0.01em",
                  marginTop: 2,
                }}
              >
                {ct}{" "}
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--atlas-muted)",
                    letterSpacing: ".1em",
                  }}
                >
                  &middot; {pct}%
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  background: "var(--atlas-rule)",
                  marginTop: 6,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${pct}%`,
                    background: typeVar,
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
      <div className="intl-mem-list" style={{ marginTop: 6 }}>
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
            return (
              <Link
                key={m.id}
                href={`/atlas/${m.slug}/chamber`}
                className="intl-mem-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
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
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
