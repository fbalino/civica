"use client";

import type { ChamberData, Country } from "../data";
import { Hemicycle } from "../Hemicycle";

export interface ChamberTabProps {
  active: boolean;
  country: Country;
  house: "upper" | "lower";
  cd: ChamberData;
  dimmed: Set<string>;
  onHouseChange: (house: "upper" | "lower") => void;
  onDimToggle: (partyId: string) => void;
  onSeatHover: (
    info: {
      member: { name: string; district: string };
      party: { name: string };
      index: number;
    },
    e: { clientX: number; clientY: number },
  ) => void;
  onSeatLeave: () => void;
}

/**
 * Phase B — Structure tab polish.
 *
 * Layout reorganised from the legacy Atlas:
 *  - Lower / Upper toggle moved ABOVE the title (was on the right of it).
 *  - The duplicate house heading that used to render inside
 *    `.atlas-chamber-title` is gone — the outer eyebrow + serif name now
 *    own the heading. The inline hint ("545 seats · hover a seat…")
 *    survives as a thin sub-row.
 *  - A new <details> "All political parties" accordion at the bottom
 *    surfaces the full per-party breakdown (seat count + share) for
 *    cases where the legend's pill list is too compact to scan.
 */
export function ChamberTab({
  active,
  country,
  house,
  cd,
  dimmed,
  onHouseChange,
  onDimToggle,
  onSeatHover,
  onSeatLeave,
}: ChamberTabProps) {
  const currentHouse = house === "upper" && cd.upper ? cd.upper : cd.lower;
  const hasUpper = !!cd.upper;
  const hasData =
    !!currentHouse && currentHouse.total > 0 && currentHouse.parties.length > 0;

  // Parties sorted by seat share, highest first — used in the
  // "All political parties" accordion.
  const sortedParties = hasData
    ? [...currentHouse.parties].sort((a, b) => b.seats - a.seats)
    : [];

  return (
    <div className={`atlas-pane${active ? " on" : ""}`}>
      {hasData ? (
        <>
          {/* House toggle — pulled out of the heading row and placed
              above the title for clearer scan order. */}
          <div className="atlas-house-toggle atlas-house-toggle--above">
            <button
              className={house === "lower" ? "on" : ""}
              onClick={() => onHouseChange("lower")}
            >
              Lower house
            </button>
            <button
              className={house === "upper" ? "on" : ""}
              disabled={!hasUpper}
              onClick={() => onHouseChange("upper")}
            >
              Upper house
            </button>
          </div>

          <div className="atlas-chamber-head">
            <div
              className="atlas-mono"
              style={{
                fontSize: 10,
                color: "var(--atlas-muted)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {country.name.toUpperCase()} &middot;{" "}
              {house === "upper" ? "UPPER" : "LOWER"} HOUSE
            </div>
            <div
              className="atlas-serif"
              style={{
                fontSize: 40,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              {currentHouse.name}
            </div>
            <div
              className="atlas-sans"
              style={{
                fontSize: 13,
                color: "var(--atlas-ink-2)",
                marginTop: 6,
              }}
            >
              {currentHouse.sub}
            </div>
          </div>

          <div className="atlas-chamber-stage">
            {/* Compact hint replaces the old internal heading. */}
            <div className="atlas-chamber-hint">
              {currentHouse.total} seats &middot; hover a seat for the
              member&apos;s name
            </div>
            <Hemicycle
              chamber={currentHouse}
              dimmed={dimmed}
              onSeatHover={(info, e) =>
                onSeatHover(info, { clientX: e.clientX, clientY: e.clientY })
              }
              onSeatLeave={onSeatLeave}
            />
          </div>

          {/* Legend pill grid removed — the "All political parties"
              accordion below is the canonical, accurate party listing.
              The pill grid duplicated the data and the implicit two-tone
              layout could be misleading on multi-party chambers. */}

          <div
            className="atlas-chamber-meta"
            style={{ marginTop: 18, borderTop: "1px solid var(--atlas-rule)" }}
          >
            <div className="cell">
              <div className="k">Total seats</div>
              <div className="v">{currentHouse.total}</div>
            </div>
            <div className="cell">
              <div className="k">Majority line</div>
              <div className="v">{Math.ceil(currentHouse.total / 2) + 1}</div>
            </div>
            <div className="cell">
              <div className="k">Ruling coalition</div>
              <div className="v" style={{ fontSize: 14 }}>
                {cd.coalition || "—"}
              </div>
            </div>
            <div className="cell">
              <div className="k">Next election</div>
              <div className="v">{cd.next || "—"}</div>
            </div>
          </div>

          <details className="atlas-parties-accordion">
            <summary>
              <span className="atlas-parties-accordion-title">
                All political parties
              </span>
              <span className="atlas-parties-accordion-meta">
                {sortedParties.length}{" "}
                {sortedParties.length === 1 ? "party" : "parties"} &middot;{" "}
                {currentHouse.total} seats
              </span>
              <span className="atlas-parties-accordion-chev" aria-hidden="true">
                ▾
              </span>
            </summary>
            <div className="atlas-parties-list">
              {sortedParties.map((p) => {
                const pct = (p.seats / currentHouse.total) * 100;
                return (
                  <div key={p.id} className="atlas-parties-row">
                    <span
                      className="atlas-parties-swatch"
                      style={{ background: p.color }}
                      aria-hidden="true"
                    />
                    <span className="atlas-parties-name">{p.name}</span>
                    <span className="atlas-parties-bar">
                      <span
                        className="atlas-parties-bar-fill"
                        style={{
                          width: `${pct.toFixed(1)}%`,
                          background: p.color,
                        }}
                      />
                    </span>
                    <span className="atlas-parties-seats">
                      {p.seats}
                      <span className="atlas-parties-pct">
                        {" "}
                        &middot; {pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        </>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <div
            className="atlas-mono"
            style={{
              fontSize: 10,
              color: "var(--atlas-muted)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            {country.name.toUpperCase()} &middot; LEGISLATURE
          </div>
          <div
            className="atlas-serif"
            style={{ fontSize: 24, color: "var(--atlas-ink-2)", marginBottom: 8 }}
          >
            Composition data not yet available
          </div>
          <div
            className="atlas-sans"
            style={{ fontSize: 13, color: "var(--atlas-muted)" }}
          >
            Legislative seat data for {country.name} has not been ingested yet.
          </div>
        </div>
      )}
    </div>
  );
}
