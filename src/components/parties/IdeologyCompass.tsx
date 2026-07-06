"use client";

/**
 * IdeologyCompass — a 2-D party-ideology scatter ("political compass") in the
 * canonical Civica chart style (see FactbookLegislatureChart / EigenvalueChart /
 * IndicatorTrendChart).
 *
 *   X axis  economic LEFT ↔ RIGHT   — V-Party `v2pariglef` interval point
 *           estimate, roughly −4 (far-left) … +4 (far-right), centred on 0.
 *   Y axis  PLURALIST ↔ ANTI-PLURALIST — V-Party `v2xpa_antiplural`
 *           Anti-Pluralism Index, 0 (pluralist, bottom) … 1 (anti-pluralist,
 *           top). Labelled honestly per the sourcing resolution — NOT the
 *           political-compass meme's "authoritarian ↔ libertarian".
 *
 * Each plotted party is a dot in its own brand colour (a design token when the
 * source recorded none). Dot radius optionally scales with the party's share of
 * its chamber, so parties that hold power read larger. Hover surfaces the
 * canonical Tooltip with party, country, seats, and both axis values.
 *
 * PROVENANCE IS LOAD-BEARING (resolution §5): a party with no V-Party position
 * is NEVER plotted and NEVER given a placeholder dot — it lives in the list with
 * an honest "ideology not recorded" chip. This component only ever receives the
 * already-matched subset.
 *
 * CONSTRUCTION STYLE — follows the canonical SVG reference:
 *   • server-renderable inline SVG, fluid `viewBox` scaling (SSR draws the full
 *     scatter; the client layer only adds hover + optional highlight filtering);
 *   • hairline 1px ink axes through the centre, NO decorative shadows;
 *   • all fills/strokes from `var(--*)` design tokens (party brand colours are
 *     runtime source data, not hardcoded literals);
 *   • Inter labels; quadrant captions are muted uppercase small-caps;
 *   • EVERY coordinate rounded to 2 decimals so SSR (Node) and the browser
 *     serialise byte-identical attributes (the hydration rule).
 */

import { useMemo, useState } from "react";
import { Tooltip } from "@/components/editorial/Tooltip";

export interface CompassParty {
  /** Stable key (the legislature_parties row id). */
  id: string;
  partyName: string;
  countryName: string;
  seatCount: number;
  /** Share of the party's own chamber, 0–1. Null → treated as smallest dot. */
  seatShare: number | null;
  /** Brand colour hex from source data; null falls back to a token. */
  color: string | null;
  /** X — economic left–right point estimate (≈ −4 … +4). */
  economicLR: number;
  /** Y — anti-pluralism index, 0 (pluralist) … 1 (anti-pluralist). */
  antiPlural: number;
}

interface IdeologyCompassProps {
  parties: CompassParty[];
  /**
   * When set, dots whose id is NOT in this set are dimmed (used to reflect the
   * page's active filter). Null/undefined → every dot at full strength.
   */
  highlightIds?: ReadonlySet<string> | null;
  /** Scale dot radius by seat share. Default true. */
  scaleBySeatShare?: boolean;
  /** Accessible chart title (also the SVG <title>). */
  title?: string;
}

// ─── viewBox geometry (authoritative coordinate space) ──────────────
const VIEW_W = 720;
const VIEW_H = 520;
const PLOT_LEFT = 54;
const PLOT_RIGHT = 54;
const PLOT_TOP = 40;
const PLOT_BOTTOM = 48;
const PLOT_X = PLOT_LEFT;
const PLOT_Y = PLOT_TOP;
const PLOT_W = VIEW_W - PLOT_LEFT - PLOT_RIGHT;
const PLOT_H = VIEW_H - PLOT_TOP - PLOT_BOTTOM;

// Economic axis domain: symmetric around 0. The live V-Party point estimates
// span roughly −3.94 … +3.10, so ±4 frames every party with a little margin
// and keeps the centre line at a true 0 (a clean, honest midpoint).
const ELR_MIN = -4;
const ELR_MAX = 4;
// Anti-pluralism is a published 0–1 index.
const AP_MIN = 0;
const AP_MAX = 1;

const DOT_R_MIN = 3.5;
const DOT_R_MAX = 11;

/** Round to 2 decimals — SSR (Node) and browser must serialise identically. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Clamp helper. */
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Economic value → x pixel (left = negative, right = positive). */
function xAt(elr: number): number {
  const t = (clamp(elr, ELR_MIN, ELR_MAX) - ELR_MIN) / (ELR_MAX - ELR_MIN);
  return r2(PLOT_X + t * PLOT_W);
}

/** Anti-pluralism → y pixel (pluralist 0 at BOTTOM, anti-pluralist 1 at TOP). */
function yAt(ap: number): number {
  const t = (clamp(ap, AP_MIN, AP_MAX) - AP_MIN) / (AP_MAX - AP_MIN);
  return r2(PLOT_Y + PLOT_H - t * PLOT_H);
}

/** Seat share (0–1) → dot radius. Sqrt so area, not radius, tracks share. */
function radiusFor(seatShare: number | null, scale: boolean): number {
  if (!scale || seatShare == null) return r2((DOT_R_MIN + DOT_R_MAX) / 2 - 2);
  const s = clamp(seatShare, 0, 1);
  return r2(DOT_R_MIN + Math.sqrt(s) * (DOT_R_MAX - DOT_R_MIN));
}

/** Compact economic-axis label, e.g. "+0.79" / "−3.43". */
function fmtELR(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

/** One tooltip body for a plotted party. */
function partyTooltip(p: CompassParty) {
  return (
    <div className="ideology-compass-tip">
      <div className="ideology-compass-tip-name">{p.partyName}</div>
      <div className="ideology-compass-tip-country">{p.countryName}</div>
      <dl className="ideology-compass-tip-rows">
        <div className="ideology-compass-tip-row">
          <dt>Seats</dt>
          <dd>
            {p.seatCount.toLocaleString()}
            {p.seatShare != null ? ` · ${Math.round(p.seatShare * 100)}%` : ""}
          </dd>
        </div>
        <div className="ideology-compass-tip-row">
          <dt>Economic L–R</dt>
          <dd>{fmtELR(p.economicLR)}</dd>
        </div>
        <div className="ideology-compass-tip-row">
          <dt>Anti-pluralism</dt>
          <dd>{p.antiPlural.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function IdeologyCompass({
  parties,
  highlightIds = null,
  scaleBySeatShare = true,
  title = "Party ideology compass — economic left–right against anti-pluralism",
}: IdeologyCompassProps) {
  // Hovered dot id, so we can lift it above its neighbours and ring it.
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Precompute plot coordinates once. Larger dots drawn first so small dots
  // stay clickable on top; the hovered dot is always lifted last.
  const dots = useMemo(() => {
    return parties
      .map((p) => ({
        p,
        cx: xAt(p.economicLR),
        cy: yAt(p.antiPlural),
        r: radiusFor(p.seatShare, scaleBySeatShare),
      }))
      .sort((a, b) => b.r - a.r);
  }, [parties, scaleBySeatShare]);

  const centerX = xAt(0);

  // Soft-fail: nothing matched → render nothing (the page shows its own empty
  // state); never draw an empty frame.
  if (dots.length === 0) return null;

  const isDimmed = (id: string) =>
    highlightIds != null && !highlightIds.has(id);

  return (
    <div className="ideology-compass">
      <div className="ideology-compass-chart-wrap">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width="100%"
          role="img"
          aria-label={`${title}. ${dots.length} parties plotted.`}
          className="ideology-compass-svg"
        >
          {/* Plot field (subtle paper-tone fill). */}
          <rect
            x={PLOT_X}
            y={PLOT_Y}
            width={PLOT_W}
            height={PLOT_H}
            fill="var(--color-grid-cell)"
          />

          {/* Quadrant captions — muted uppercase small-caps, one per corner. */}
          <text
            x={PLOT_X + 10}
            y={PLOT_Y + 18}
            textAnchor="start"
            className="ideology-compass-quadrant"
            fill="var(--color-text-30)"
          >
            Left · anti-pluralist
          </text>
          <text
            x={PLOT_X + PLOT_W - 10}
            y={PLOT_Y + 18}
            textAnchor="end"
            className="ideology-compass-quadrant"
            fill="var(--color-text-30)"
          >
            Right · anti-pluralist
          </text>
          <text
            x={PLOT_X + 10}
            y={PLOT_Y + PLOT_H - 10}
            textAnchor="start"
            className="ideology-compass-quadrant"
            fill="var(--color-text-30)"
          >
            Left · pluralist
          </text>
          <text
            x={PLOT_X + PLOT_W - 10}
            y={PLOT_Y + PLOT_H - 10}
            textAnchor="end"
            className="ideology-compass-quadrant"
            fill="var(--color-text-30)"
          >
            Right · pluralist
          </text>

          {/* Central axes (hairline ink) — vertical at economic 0, horizontal
              at the anti-pluralism midpoint. */}
          <line
            x1={centerX}
            x2={centerX}
            y1={PLOT_Y}
            y2={PLOT_Y + PLOT_H}
            stroke="var(--color-text-primary)"
            strokeWidth={1}
            strokeOpacity={0.55}
          />
          <line
            x1={PLOT_X}
            x2={PLOT_X + PLOT_W}
            y1={yAt((AP_MIN + AP_MAX) / 2)}
            y2={yAt((AP_MIN + AP_MAX) / 2)}
            stroke="var(--color-text-primary)"
            strokeWidth={1}
            strokeOpacity={0.55}
          />

          {/* Plot border (hairline). */}
          <rect
            x={PLOT_X}
            y={PLOT_Y}
            width={PLOT_W}
            height={PLOT_H}
            fill="none"
            stroke="var(--color-text-primary)"
            strokeWidth={1}
          />

          {/* Party dots. Larger first (sorted above); the hovered dot is
              re-drawn last with an emphasis ring. */}
          {dots.map(({ p, cx, cy, r }) => {
            const dim = isDimmed(p.id);
            return (
              <circle
                key={p.id}
                cx={cx}
                cy={cy}
                r={r}
                fill={p.color ?? "var(--color-text-40)"}
                stroke="var(--color-card-bg)"
                strokeWidth={1}
                fillOpacity={dim ? 0.16 : 0.82}
                strokeOpacity={dim ? 0.16 : 1}
              />
            );
          })}

          {/* Hovered dot, lifted and ringed for legibility. */}
          {hoverId != null
            ? dots
                .filter((d) => d.p.id === hoverId)
                .map(({ p, cx, cy, r }) => (
                  <circle
                    key={`hover-${p.id}`}
                    cx={cx}
                    cy={cy}
                    r={r + 2}
                    fill={p.color ?? "var(--color-text-40)"}
                    stroke="var(--color-text-primary)"
                    strokeWidth={1.5}
                    fillOpacity={0.95}
                  />
                ))
            : null}

          {/* Axis end labels. */}
          <text
            x={PLOT_X - 8}
            y={PLOT_Y + PLOT_H / 2}
            textAnchor="middle"
            className="ideology-compass-axis-label"
            fill="var(--color-text-50)"
            transform={`rotate(-90 ${PLOT_X - 8} ${PLOT_Y + PLOT_H / 2})`}
          >
            Pluralist ↔ Anti-pluralist
          </text>
          <text
            x={PLOT_X + PLOT_W / 2}
            y={PLOT_Y + PLOT_H + 34}
            textAnchor="middle"
            className="ideology-compass-axis-label"
            fill="var(--color-text-50)"
          >
            Economic left ↔ right
          </text>

          {/* Economic-axis end ticks (−4 / +4) for scale legibility. */}
          <text
            x={PLOT_X + 4}
            y={PLOT_Y + PLOT_H + 16}
            textAnchor="start"
            className="ideology-compass-tick"
            fill="var(--color-text-40)"
          >
            Left
          </text>
          <text
            x={PLOT_X + PLOT_W - 4}
            y={PLOT_Y + PLOT_H + 16}
            textAnchor="end"
            className="ideology-compass-tick"
            fill="var(--color-text-40)"
          >
            Right
          </text>
        </svg>

        {/*
          Hover overlay — one absolutely-positioned hit node per plotted party,
          positioned in PERCENT over the fluid SVG (percent maps 1:1 to the
          viewBox because the SVG is width:100% with a fixed aspect ratio). It
          lives OUTSIDE the <svg> so each node can be wrapped in the canonical
          <Tooltip> primitive (an HTML wrapper is invalid inside <svg>). Dimmed
          (filtered-out) dots keep their tooltip but read as inactive.
        */}
        <div className="ideology-compass-hover-layer" aria-hidden={false}>
          {dots.map(({ p, cx, cy, r }) => {
            const size = Math.max(r * 2, 16);
            const leftPct = (cx / VIEW_W) * 100;
            const topPct = (cy / VIEW_H) * 100;
            const wPct = (size / VIEW_W) * 100;
            const hPct = (size / VIEW_H) * 100;
            return (
              <Tooltip
                key={`hz-${p.id}`}
                content={partyTooltip(p)}
                className="ideology-compass-hover-col"
                triggerStyle={{
                  left: `${r2(leftPct - wPct / 2)}%`,
                  top: `${r2(topPct - hPct / 2)}%`,
                  width: `${r2(wPct)}%`,
                  height: `${r2(hPct)}%`,
                }}
              >
                <span
                  className="ideology-compass-hover-hit"
                  aria-label={`${p.partyName}, ${p.countryName}`}
                  onMouseEnter={() => setHoverId(p.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(p.id)}
                  onBlur={() => setHoverId(null)}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
