"use client";

import type { ChamberData, Country } from "../data";
import { Hemicycle, PartyLegend } from "../Hemicycle";

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

  return (
    <div className={`atlas-pane${active ? " on" : ""}`}>
      {currentHouse && currentHouse.total > 0 && currentHouse.parties.length > 0 ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
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
                style={{ fontSize: 13, color: "var(--atlas-ink-2)", marginTop: 6 }}
              >
                {currentHouse.sub}
              </div>
            </div>
            <div className="atlas-house-toggle">
              <button
                className={house === "lower" ? "on" : ""}
                onClick={() => onHouseChange("lower")}
              >
                Lower house
              </button>
              <button
                className={house === "upper" ? "on" : ""}
                disabled={!cd.upper}
                onClick={() => onHouseChange("upper")}
              >
                Upper house
              </button>
            </div>
          </div>

          <div className="atlas-chamber-stage">
            <div className="atlas-chamber-title">
              <span className="nm">{currentHouse.name}</span>
              <span className="sub">
                {currentHouse.total} seats &middot; hover a seat for the
                member&apos;s name
              </span>
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

          <PartyLegend
            key={`${country.id}-${house}`}
            chamber={currentHouse}
            dimmed={dimmed}
            onToggle={onDimToggle}
          />

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
