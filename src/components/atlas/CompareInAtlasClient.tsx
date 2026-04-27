"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ChamberData,
  type Country,
  getDefaultChamberData as getFallbackChamberData,
} from "./data";
import type { AtlasChamberData } from "@/lib/atlas/load-atlas-data";
import { Hemicycle, PartyLegend } from "./Hemicycle";

type House = "lower" | "upper";

interface SeatTip {
  member: { name: string; district: string };
  party: { name: string };
  index: number;
  x: number;
  y: number;
}

export interface CompareInAtlasClientProps {
  countries: Country[];
  dbChambers: Record<string, AtlasChamberData>;
  initialA: string;
  initialB: string;
}

/**
 * Phase A.6 (Option α) — In-atlas compare, recovered from the deleted
 * AtlasApp.tsx (commit df32da9^). Two ComparePane columns side-by-side
 * inside the shell's center pane. Country and house selections sync to
 * the URL (?a=, ?b=, ?ah=, ?bh=) via shallow router.replace, so the page
 * stays SPA-fast like the legacy version while remaining shareable.
 *
 * The longer-form scrollable comparison view still lives at /compare —
 * this is the "fast" variant the user wanted back.
 */
export function CompareInAtlasClient({
  countries,
  dbChambers,
  initialA,
  initialB,
}: CompareInAtlasClientProps) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [houseA, setHouseA] = useState<House>("lower");
  const [houseB, setHouseB] = useState<House>("lower");
  const [dimmed] = useState<Set<string>>(new Set());
  const [seatTip, setSeatTip] = useState<SeatTip | null>(null);

  const updateUrl = useCallback(
    (next: { a?: string; b?: string; ah?: House; bh?: House }) => {
      const url = new URL(window.location.href);
      if (next.a) url.searchParams.set("a", next.a);
      if (next.b) url.searchParams.set("b", next.b);
      if (next.ah) url.searchParams.set("ah", next.ah);
      if (next.bh) url.searchParams.set("bh", next.bh);
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  function getChamberData(id: string): ChamberData {
    const dc = dbChambers[id];
    if (dc) {
      return {
        lower: {
          ...dc.lower,
          parties:
            dc.lower.parties.length > 0
              ? dc.lower.parties
              : [
                  {
                    id: "unk",
                    name: "Unknown",
                    seats: dc.lower.total || 1,
                    color: "gray",
                  },
                ],
        },
        upper: dc.upper
          ? {
              ...dc.upper,
              parties:
                dc.upper.parties.length > 0
                  ? dc.upper.parties
                  : [
                      {
                        id: "unk",
                        name: "Unknown",
                        seats: dc.upper.total || 1,
                        color: "gray",
                      },
                    ],
            }
          : null,
        branches: dc.branches,
        coalition: undefined,
        next: undefined,
        bills: [],
      };
    }
    return getFallbackChamberData(id);
  }

  const onSeatHover = (
    info: {
      member: { name: string; district: string };
      party: { name: string; id: string };
      index: number;
    },
    e: React.MouseEvent,
  ) =>
    setSeatTip({
      member: info.member,
      party: info.party,
      index: info.index,
      x: e.clientX + 14,
      y: e.clientY + 14,
    });
  const onSeatLeave = () => setSeatTip(null);

  return (
    <div className="atlas-compare-grid">
      <ComparePane
        countryId={a}
        side="A"
        house={houseA}
        countries={countries}
        getChamberData={getChamberData}
        dimmed={dimmed}
        onChangeCountry={(id) => {
          setA(id);
          setHouseA("lower");
          updateUrl({ a: id, ah: "lower" });
        }}
        onChangeHouse={(h) => {
          setHouseA(h);
          updateUrl({ ah: h });
        }}
        onSeatHover={onSeatHover}
        onSeatLeave={onSeatLeave}
      />
      <div className="atlas-resizer decorative" />
      <ComparePane
        countryId={b}
        side="B"
        house={houseB}
        countries={countries}
        getChamberData={getChamberData}
        dimmed={dimmed}
        onChangeCountry={(id) => {
          setB(id);
          setHouseB("lower");
          updateUrl({ b: id, bh: "lower" });
        }}
        onChangeHouse={(h) => {
          setHouseB(h);
          updateUrl({ bh: h });
        }}
        onSeatHover={onSeatHover}
        onSeatLeave={onSeatLeave}
      />

      {seatTip ? (
        <div
          className="atlas-seat-tip"
          style={{ left: seatTip.x, top: seatTip.y }}
        >
          <div className="nm">{seatTip.member.name}</div>
          <div className="pty">{seatTip.party.name}</div>
          <div className="dis">
            {seatTip.member.district} &middot; Seat {seatTip.index + 1}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComparePane({
  countryId,
  side,
  house,
  onChangeCountry,
  onChangeHouse,
  dimmed,
  onSeatHover,
  onSeatLeave,
  countries,
  getChamberData,
}: {
  countryId: string;
  side: string;
  house: House;
  onChangeCountry: (id: string) => void;
  onChangeHouse: (h: House) => void;
  dimmed: Set<string>;
  onSeatHover: (
    info: {
      member: { name: string; district: string };
      party: { name: string; id: string };
      index: number;
    },
    e: React.MouseEvent,
  ) => void;
  onSeatLeave: () => void;
  countries: Country[];
  getChamberData: (id: string) => ChamberData;
}) {
  const c = countries.find((x) => x.id === countryId);
  if (!c) {
    return (
      <div className="atlas-compare-pane">
        <div className="atlas-compare-heading">
          <span>Compare &middot; Side {side}</span>
        </div>
        <div style={{ padding: 32, color: "var(--atlas-muted)" }}>
          Unknown country: {countryId}
        </div>
      </div>
    );
  }
  const cd = getChamberData(countryId);
  const chamber = house === "upper" && cd.upper ? cd.upper : cd.lower;
  const hasUpper = !!cd.upper;

  return (
    <div
      className={`atlas-compare-pane${side === "A" ? " atlas-compare-divider" : ""}`}
    >
      <div className="atlas-compare-heading">
        <span>Compare &middot; Side {side}</span>
        <select
          value={countryId}
          onChange={(e) => onChangeCountry(e.target.value)}
          className="atlas-mono"
          style={{
            fontSize: 11,
            padding: "4px 6px",
            border: "1px solid var(--atlas-ink)",
            background: "var(--atlas-paper)",
            color: "var(--atlas-ink)",
          }}
        >
          {countries.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ padding: "28px 32px 18px" }}>
        <div
          className="atlas-mono"
          style={{
            fontSize: 10,
            color: "var(--atlas-muted)",
            letterSpacing: ".14em",
            textTransform: "uppercase",
          }}
        >
          {c.region} &middot; {c.id.toUpperCase()}
        </div>
        <h1
          className="atlas-serif"
          style={{
            fontWeight: 400,
            fontSize: 40,
            letterSpacing: "-0.02em",
            margin: "4px 0 4px",
            lineHeight: 1,
          }}
        >
          {c.name}
        </h1>
        <div
          className="atlas-sans"
          style={{ fontSize: 13, color: "var(--atlas-ink-2)" }}
        >
          {chamber.name} &middot; {chamber.sub}
        </div>
        <div className="atlas-house-toggle" style={{ marginTop: 14 }}>
          <button
            className={house === "lower" ? "on" : ""}
            onClick={() => onChangeHouse("lower")}
          >
            Lower
          </button>
          <button
            className={house === "upper" ? "on" : ""}
            disabled={!hasUpper}
            onClick={() => onChangeHouse("upper")}
          >
            Upper
          </button>
        </div>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="atlas-chamber-stage">
          <div className="atlas-chamber-title">
            <span className="nm">{chamber.name}</span>
            <span className="sub">{chamber.total} seats</span>
          </div>
          <Hemicycle
            chamber={chamber}
            dimmed={dimmed}
            onSeatHover={onSeatHover}
            onSeatLeave={onSeatLeave}
          />
        </div>
        <div className="atlas-chamber-meta">
          <div className="cell">
            <div className="k">Seats</div>
            <div className="v">{chamber.total}</div>
          </div>
          <div className="cell">
            <div className="k">Majority</div>
            <div className="v">{Math.ceil(chamber.total / 2) + 1}</div>
          </div>
          <div className="cell">
            <div className="k">Leader</div>
            <div className="v" style={{ fontSize: 14 }}>
              {c.leader}
            </div>
          </div>
        </div>
        <PartyLegend chamber={chamber} dimmed={new Set()} onToggle={() => {}} />
      </div>
      <div style={{ padding: "24px 32px 60px" }}>
        <div
          className="atlas-mono"
          style={{
            fontSize: 10,
            color: "var(--atlas-muted)",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Active legislation &middot; top 2
        </div>
        {(cd.bills || []).slice(0, 2).map((bill, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--atlas-rule)",
              padding: "14px 16px",
              marginBottom: 8,
            }}
          >
            <div
              className="atlas-serif"
              style={{ fontSize: 17, lineHeight: 1.25, marginBottom: 4 }}
            >
              {bill.title}
            </div>
            <div
              className="atlas-sans"
              style={{
                fontSize: 12,
                color: "var(--atlas-ink-2)",
                lineHeight: 1.5,
              }}
            >
              {bill.summary}
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                className="atlas-mono"
                style={{
                  fontSize: 10,
                  color: "var(--atlas-accent)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  border: "1px solid var(--atlas-accent)",
                  padding: "2px 6px",
                }}
              >
                {bill.status}
              </span>
            </div>
          </div>
        ))}
        {(cd.bills || []).length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--atlas-muted)",
              fontStyle: "italic",
            }}
          >
            No active legislation tracked.
          </div>
        ) : null}
      </div>
    </div>
  );
}
