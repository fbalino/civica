"use client";

import { useRef, useCallback } from "react";
import { type Chamber, type Party, PARTY_COLORS, getMember } from "./data";

function resolveColor(color: string): string {
  if (color.startsWith("#") || color.startsWith("oklch") || color.startsWith("rgb")) return color;
  return PARTY_COLORS[color] || color;
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
  const perRow = radii.map((r) => Math.max(3, Math.round(total * r / weightSum)));
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
      const x = Math.cos(angle) * radius;
      const y = -Math.sin(angle) * radius;
      seats.push({ x, y, angle, row: r });
    }
  }
  seats.sort((a, b) => b.angle - a.angle);
  return seats;
}

interface HemicycleProps {
  chamber: Chamber;
  dimmed: Set<string>;
  onSeatHover?: (info: { member: { name: string; district: string }; party: Party; index: number }, e: React.MouseEvent) => void;
  onSeatLeave?: () => void;
}

export function Hemicycle({ chamber, dimmed, onSeatHover, onSeatLeave }: HemicycleProps) {
  const seats = seatLayout(chamber.total);
  const parties = chamber.parties;
  const seatParty: Party[] = new Array(seats.length);
  let idx = 0;
  parties.forEach((p) => {
    for (let k = 0; k < p.seats && idx < seats.length; k++) {
      seatParty[idx++] = p;
    }
  });
  while (idx < seats.length) seatParty[idx++] = parties[parties.length - 1];

  const handleMouseEnter = useCallback(
    (i: number, p: Party, e: React.MouseEvent) => {
      const m = getMember(p.id, i);
      onSeatHover?.({ member: m, party: p, index: i }, e);
    },
    [onSeatHover],
  );

  return (
    <svg className="atlas-hemi" viewBox="-260 -240 520 260" preserveAspectRatio="xMidYMid meet">
      {/* Rostrum */}
      <path d="M -50 0 A 50 50 0 0 1 50 0 L 50 -8 L -50 -8 Z" fill="var(--atlas-paper-2)" stroke="var(--atlas-ink)" strokeWidth="1" />
      <text x={0} y={-18} textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="6" letterSpacing="1.2" fill="var(--atlas-muted)">
        ROSTRUM
      </text>
      {/* Majority line */}
      <line x1={0} x2={0} y1={-240} y2={-50} stroke="var(--atlas-accent)" strokeWidth="0.6" strokeDasharray="2 3" />
      <text x={3} y={-230} fontFamily="ui-monospace,monospace" fontSize="5" letterSpacing="1" fill="var(--atlas-accent)">
        MAJORITY {Math.ceil(chamber.total / 2) + 1}
      </text>
      {/* Seats */}
      {seats.map((s, i) => {
        const p = seatParty[i];
        return (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={2.1}
            fill={resolveColor(p.color)}
            stroke="color-mix(in oklab, currentColor, black 20%)"
            strokeWidth="0.2"
            className={`seat${dimmed.has(p.id) ? " dim" : ""}`}
            onMouseEnter={(e) => handleMouseEnter(i, p, e)}
            onMouseMove={(e) => handleMouseEnter(i, p, e)}
            onMouseLeave={onSeatLeave}
          />
        );
      })}
    </svg>
  );
}

interface PartyLegendProps {
  chamber: Chamber;
  dimmed: Set<string>;
  onToggle: (partyId: string) => void;
}

export function PartyLegend({ chamber, dimmed, onToggle }: PartyLegendProps) {
  return (
    <div className="atlas-party-legend">
      {chamber.parties.map((p) => {
        const pct = ((p.seats / chamber.total) * 100).toFixed(1);
        return (
          <div key={p.id} className={`p${dimmed.has(p.id) ? " dim" : ""}`} onClick={() => onToggle(p.id)}>
            <span className="sw" style={{ background: resolveColor(p.color) }} />
            <div className="col">
              <span className="nm">{p.name}</span>
              <span className="seats">
                {p.seats} &middot; {pct}%
              </span>
            </div>
            <div className="bar">
              <div className="fill" style={{ width: `${pct}%`, background: PARTY_COLORS[p.color] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
