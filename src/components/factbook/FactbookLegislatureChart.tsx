"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { LegislatureChamber } from "@/lib/factbook/legislature";
import type { ChamberCoalition } from "@/lib/db/queries-legislature";
import { absoluteMajorityThreshold } from "@/lib/legislatures/majority";
import {
  attributeSeats,
  seatCountLabel,
  UNATTRIBUTED_SEAT_LABEL,
} from "@/lib/legislatures/seat-attribution";
import { ChamberComposition } from "./ChamberComposition";
import { PartyBrowser } from "./PartyBrowser";

/**
 * Client-side hemicycle chart for the factbook Legislature section.
 *
 * Ported from `src/components/atlas/Hemicycle.tsx` + the All-Parties
 * accordion in `src/components/atlas/tabs/ChamberTab.tsx`. The visual
 * geometry (radii, seat sizing, rostrum, majority line) is intentionally
 * identical so the factbook chart looks the same as the atlas one.
 *
 * State is local: the `dimmed` set lives in this component and is
 * toggled by clicks on the per-party rows. We don't sync it to a URL
 * the way atlas does, because the factbook page is a long-form scroll
 * surface and users won't deep-link to a specific dim filter.
 */

interface FactbookLegislatureChartProps {
  chamber: LegislatureChamber;
  /** "Lower house" | "Upper house" | "Legislature" — passed in by parent. */
  houseLabel: string;
  countryName: string;
  /**
   * Governing-coalition signal for this chamber, when the underlying body has
   * `is_ruling_coalition` flags. Null for the vast majority of bodies — the
   * composition balance bar + browser tags are simply omitted in that case.
   */
  coalition?: ChamberCoalition | null;
}

interface SeatPos {
  x: number;
  y: number;
  angle: number;
  row: number;
}

function seatLayout(total: number): SeatPos[] {
  const rows = Math.max(6, Math.round(Math.sqrt(total / 3.1)));
  const seats: SeatPos[] = [];
  const radii: number[] = [];
  for (let r = 0; r < rows; r++) radii.push(r + 1);
  const weightSum = radii.reduce((a, b) => a + b, 0);
  const perRow = radii.map((r) =>
    Math.max(3, Math.round((total * r) / weightSum))
  );
  let diff = total - perRow.reduce((a, b) => a + b, 0);
  let i = perRow.length - 1;
  while (diff !== 0) {
    perRow[i] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    i = (i - 1 + perRow.length) % perRow.length;
  }
  const innerR = 80;
  const outerR = 220;
  const seatSize = (outerR - innerR) / rows;
  for (let r = 0; r < rows; r++) {
    const radius = innerR + seatSize * r + seatSize / 2;
    const n = perRow[r];
    for (let s = 0; s < n; s++) {
      const t = n === 1 ? 0.5 : s / (n - 1);
      const angle = Math.PI * (1 - t);
      // Round to 2 decimals so SSR (Node) + browser serialize identical cx/cy
      // SVG attrs — avoids React hydration mismatch from cos/sin float drift.
      const x = Math.round(Math.cos(angle) * radius * 100) / 100;
      const y = Math.round(-Math.sin(angle) * radius * 100) / 100;
      seats.push({ x, y, angle, row: r });
    }
  }
  seats.sort((a, b) => b.angle - a.angle);
  return seats;
}

export function FactbookLegislatureChart({
  chamber,
  houseLabel,
  countryName,
  coalition = null,
}: FactbookLegislatureChartProps) {
  const [dimmed, setDimmed] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<{
    partyName: string;
    seatIndex: number;
    x: number;
    y: number;
  } | null>(null);
  const svgIdBase = `legislature-composition-${chamber.id}-${houseLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
  const svgTitleId = `${svgIdBase}-title`;
  const svgDescId = `${svgIdBase}-description`;
  const svgTitle = `${chamber.name} seat composition`;

  const seats = useMemo(
    () => (chamber.total > 0 ? seatLayout(chamber.total) : []),
    [chamber.total]
  );

  // Seats the party rows do not cover are drawn as unattributed (neutral,
  // never a party colour); party rows beyond the total are not drawn.
  const attribution = useMemo(
    () => attributeSeats(seats.length, chamber.parties),
    [chamber.parties, seats.length]
  );
  const seatParty = attribution.seats;
  const unattributedSeats = attribution.unattributedSeats;

  const seatGroups = [
    ...chamber.parties.map((party) => `${party.name}, ${party.seats} seats`),
    ...(unattributedSeats > 0
      ? [`${UNATTRIBUTED_SEAT_LABEL}, ${seatCountLabel(unattributedSeats)}`]
      : []),
  ];
  const svgDescription = [
    seatGroups.length > 0 ? `${seatGroups.join("; ")}.` : null,
    attribution.excessPartySeats > 0
      ? `The party rows add up to ${attribution.reportedPartySeats} seats, more than the chamber's ${seats.length}; the drawing shows ${seats.length} seats.`
      : null,
    "The Party browser below provides the same party, seat, share, and coalition data as native document content.",
  ]
    .filter(Boolean)
    .join(" ");

  const sortedParties = useMemo(
    () => [...chamber.parties].sort((a, b) => b.seats - a.seats),
    [chamber.parties]
  );

  const majorityLine = absoluteMajorityThreshold(chamber.total);

  function toggleDim(partyId: string) {
    setDimmed((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) next.delete(partyId);
      else next.add(partyId);
      return next;
    });
  }

  return (
    <div className="factbook-legislature-chamber">
      <div className="factbook-legislature-head">
        <div className="factbook-legislature-eyebrow">
          {countryName.toUpperCase()} &middot; {houseLabel.toUpperCase()}
        </div>
        <h3 className="factbook-legislature-name">{chamber.name}</h3>
        <div className="factbook-legislature-sub">
          {chamber.total}
          {" seats · hover a seat for the party"}
        </div>
      </div>

      <ChamberComposition chamber={chamber} coalition={coalition} />

      <div className="factbook-legislature-stage">
        {seats.length > 0 ? (
          <svg
            className="factbook-legislature-hemi"
            viewBox="-260 -240 520 260"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-labelledby={`${svgTitleId} ${svgDescId}`}
          >
            <title id={svgTitleId}>{svgTitle}</title>
            <desc id={svgDescId}>{svgDescription}</desc>
            {/* Rostrum */}
            <path
              d="M -50 0 A 50 50 0 0 1 50 0 L 50 -8 L -50 -8 Z"
              fill="var(--color-surface-elevated)"
              stroke="var(--color-text-primary)"
              strokeWidth="1"
            />
            <text
              x={0}
              y={-18}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="6"
              letterSpacing="1.2"
              fill="var(--color-text-40)"
            >
              ROSTRUM
            </text>
            {/* Majority line */}
            <line
              x1={0}
              x2={0}
              y1={-240}
              y2={-50}
              stroke="var(--color-accent)"
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
            {majorityLine != null && (
              <text
                x={3}
                y={-230}
                fontFamily="var(--font-mono)"
                fontSize="5"
                letterSpacing="1"
                fill="var(--color-accent)"
              >
                MAJORITY {majorityLine}
              </text>
            )}
            {/* Seats */}
            {seats.map((s, i) => {
              const p = seatParty[i];
              if (!p) return null;
              const label =
                p.kind === "party" ? p.name : UNATTRIBUTED_SEAT_LABEL;
              const showTip = (e: MouseEvent<SVGCircleElement>) =>
                setHover({
                  partyName: label,
                  seatIndex: i,
                  x: e.clientX,
                  y: e.clientY,
                });
              if (p.kind === "unattributed") {
                return (
                  <circle
                    key={i}
                    cx={s.x}
                    cy={s.y}
                    r={2.1}
                    className="factbook-legislature-seat factbook-legislature-seat--unattributed"
                    data-seat-state="unattributed"
                    onMouseEnter={showTip}
                    onMouseMove={showTip}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              }
              const isDim = dimmed.has(p.id);
              return (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r={2.1}
                  fill={p.color}
                  stroke="color-mix(in oklab, currentColor, black 20%)"
                  strokeWidth="0.2"
                  className={`factbook-legislature-seat${isDim ? " is-dim" : ""}`}
                  data-seat-party={p.id}
                  onMouseEnter={showTip}
                  onMouseMove={showTip}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
        ) : (
          <div className="factbook-legislature-empty">
            Composition data not yet ingested
          </div>
        )}
        {unattributedSeats > 0 && (
          <p className="factbook-legislature-key">
            <span
              className="factbook-legislature-key-swatch factbook-legislature-key-swatch--unattributed"
              aria-hidden="true"
            />
            {UNATTRIBUTED_SEAT_LABEL} &middot; {seatCountLabel(unattributedSeats)}
          </p>
        )}
        {hover && (
          <div
            className="factbook-legislature-tip"
            style={{
              position: "fixed",
              left: hover.x + 12,
              top: hover.y + 12,
            }}
          >
            <div className="factbook-legislature-tip-name">{hover.partyName}</div>
            <div className="factbook-legislature-tip-seat">
              Seat #{hover.seatIndex + 1}
            </div>
          </div>
        )}
      </div>

      {/* Stats grid — total / majority / coalition / next election */}
      <div className="factbook-legislature-stats">
        <div className="factbook-legislature-stat">
          <div className="factbook-legislature-stat-key">Total seats</div>
          <div className="factbook-legislature-stat-val">{chamber.total}</div>
        </div>
        <div className="factbook-legislature-stat">
          <div className="factbook-legislature-stat-key">Majority line</div>
          <div className="factbook-legislature-stat-val">{majorityLine ?? "—"}</div>
        </div>
        <div className="factbook-legislature-stat">
          <div className="factbook-legislature-stat-key">Largest party</div>
          <div className="factbook-legislature-stat-val factbook-legislature-stat-val--text">
            {sortedParties[0]?.name ?? "—"}
          </div>
        </div>
        <div className="factbook-legislature-stat">
          <div className="factbook-legislature-stat-key">Parties</div>
          <div className="factbook-legislature-stat-val">
            {sortedParties.length || "—"}
          </div>
        </div>
      </div>

      {/* Party browser — sortable, expandable per-party detail. Replaces the
          old flat list; the hemicycle dim-on-click lives here now too. */}
      {sortedParties.length > 0 && (
        <PartyBrowser
          parties={sortedParties}
          chamberTotal={chamber.total}
          coalitionPartyNames={coalition?.coalitionPartyNames ?? []}
          scopeId={chamber.id}
          dimmed={dimmed}
          onToggleDim={toggleDim}
        />
      )}
    </div>
  );
}
