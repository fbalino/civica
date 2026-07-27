"use client";

import { useMemo, useState } from "react";
import type { LegislatureParty } from "@/lib/factbook/legislature";
import { Tooltip } from "@/components/editorial/Tooltip";
import { comparePublicLabels } from "@/lib/i18n/presentation";

/**
 * Party Browser — the deepened per-party view for the Civica Data → Legislature
 * section. Sits below the canonical hemicycle and replaces the old flat
 * "All political parties" list with a sortable, expandable browser.
 *
 * HONEST-DATA POSTURE
 * -------------------
 * Party rows carry only the fields that actually exist in `legislature_parties`
 * today: name, seat count, computed seat share, a resolved colour, and — for
 * the handful of bodies where IPU/Wikidata flagged it — governing-coalition
 * membership. There is NO leader, founding year, or ideology in the DB
 * (`legislature_parties.wikidata_qid` is universally null), so this component
 * never renders those. The expanded panel shows derived, source-backed facts
 * only: seat share, within-chamber rank, distance to the largest party, and the
 * coalition tag when known.
 *
 * `coalitionPartyNames` is the lowercased set of governing-coalition party
 * names for THIS chamber (empty when the body has no coalition flags). When it
 * is empty the Government/Opposition column is omitted entirely rather than
 * guessed.
 */

interface PartyBrowserProps {
  parties: LegislatureParty[];
  chamberTotal: number;
  /** Lowercased governing-coalition party names for this chamber; may be empty. */
  coalitionPartyNames: string[];
  /** Stable id for keying when multiple browsers render on one page. */
  scopeId: string;
  /**
   * Hemicycle dim state, owned by the parent chart so clicking a party here
   * dims that party's seats in the hemicycle above. Preserves the canonical
   * "click to dim" interaction while the chevron handles expand.
   */
  dimmed: Set<string>;
  onToggleDim: (partyId: string) => void;
}

type SortKey = "seats" | "name";

function pct(seats: number, total: number): number {
  return total > 0 ? (seats / total) * 100 : 0;
}

export function PartyBrowser({
  parties,
  chamberTotal,
  coalitionPartyNames,
  scopeId,
  dimmed,
  onToggleDim,
}: PartyBrowserProps) {
  const [sort, setSort] = useState<SortKey>("seats");
  const [openId, setOpenId] = useState<string | null>(null);

  const hasCoalitionData = coalitionPartyNames.length > 0;
  const coalitionSet = useMemo(
    () => new Set(coalitionPartyNames),
    [coalitionPartyNames]
  );

  const ranked = useMemo(() => {
    // Rank is always by seats (descending) regardless of display sort so the
    // "#n largest" fact stays stable; display order can differ.
    const bySeats = [...parties].sort((a, b) => b.seats - a.seats);
    const rankOf = new Map<string, number>();
    bySeats.forEach((p, i) => rankOf.set(p.id, i + 1));
    const topSeats = bySeats[0]?.seats ?? 0;

    const display =
      sort === "name"
        ? [...parties].sort((a, b) => comparePublicLabels(a.name, b.name))
        : bySeats;

    return display.map((p) => ({
      ...p,
      rank: rankOf.get(p.id) ?? 0,
      share: pct(p.seats, chamberTotal),
      gapToLargest: topSeats - p.seats,
      inCoalition: coalitionSet.has(p.name.toLowerCase().trim()),
    }));
  }, [parties, sort, chamberTotal, coalitionSet]);

  if (parties.length === 0) {
    return (
      <div className="party-browser-empty">
        Party composition not yet ingested for this chamber.
      </div>
    );
  }

  return (
    <div className="party-browser" data-scope={scopeId}>
      <div className="party-browser-head">
        <div className="party-browser-headings">
          <span className="party-browser-title">Party browser</span>
          <span className="party-browser-hint">
            Click a party to dim it in the hemicycle · expand for detail
          </span>
        </div>
        <div className="party-browser-controls">
          <span className="party-browser-count">
            {parties.length}
            {parties.length === 1 ? " party" : " parties"}
          </span>
          <div
            className="party-browser-sort"
            role="group"
            aria-label="Sort parties"
          >
            <button
              type="button"
              className={`party-browser-sort-btn${
                sort === "seats" ? " is-active" : ""
              }`}
              aria-pressed={sort === "seats"}
              onClick={() => setSort("seats")}
            >
              Seats
            </button>
            <button
              type="button"
              className={`party-browser-sort-btn${
                sort === "name" ? " is-active" : ""
              }`}
              aria-pressed={sort === "name"}
              onClick={() => setSort("name")}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      <ul className="party-browser-list">
        {ranked.map((p) => {
          const isOpen = openId === p.id;
          const isDimmed = dimmed.has(p.id);
          return (
            <li key={p.id} className="party-browser-item">
              <div
                className={`party-browser-row${isOpen ? " is-open" : ""}${
                  isDimmed ? " is-dim" : ""
                }`}
              >
                <Tooltip
                  className="party-browser-rowmain-tip"
                  content={
                    isDimmed
                      ? `Show ${p.name} in the hemicycle`
                      : `Dim ${p.name} in the hemicycle`
                  }
                >
                <button
                  type="button"
                  className="party-browser-rowmain"
                  aria-pressed={isDimmed}
                  aria-label={
                    isDimmed
                      ? `Show ${p.name} in the hemicycle`
                      : `Dim ${p.name} in the hemicycle`
                  }
                  onClick={() => onToggleDim(p.id)}
                >
                  <span
                    className="party-browser-swatch"
                    style={{ background: p.color }}
                    aria-hidden="true"
                  />
                  <span className="party-browser-name">
                    {p.name}
                    {hasCoalitionData && p.inCoalition && (
                      <span className="party-browser-tag party-browser-tag--gov">
                        In government
                      </span>
                    )}
                  </span>
                  <span className="party-browser-bar" aria-hidden="true">
                    <span
                      className="party-browser-bar-fill"
                      style={{
                        width: `${p.share.toFixed(1)}%`,
                        background: p.color,
                      }}
                    />
                  </span>
                  <span className="party-browser-figs">
                    <span className="party-browser-seats">{p.seats}</span>
                    <span className="party-browser-pct">
                      {p.share.toFixed(1)}%
                    </span>
                  </span>
                </button>
                </Tooltip>
                <button
                  type="button"
                  className="party-browser-expand"
                  aria-expanded={isOpen}
                  aria-label={
                    isOpen
                      ? `Hide ${p.name} detail`
                      : `Show ${p.name} detail`
                  }
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                >
                  <span
                    className="party-browser-chevron"
                    data-open={isOpen ? "true" : "false"}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {isOpen && (
                <div className="party-browser-detail">
                  <div className="party-browser-detail-grid">
                    <div className="party-browser-detail-cell">
                      <span className="party-browser-detail-key">Seats held</span>
                      <span className="party-browser-detail-val">
                        {p.seats}
                        <span className="party-browser-detail-sub">
                          {" of "}
                          {chamberTotal}
                        </span>
                      </span>
                    </div>
                    <div className="party-browser-detail-cell">
                      <span className="party-browser-detail-key">
                        Seat share
                      </span>
                      <span className="party-browser-detail-val">
                        {p.share.toFixed(1)}%
                      </span>
                    </div>
                    <div className="party-browser-detail-cell">
                      <span className="party-browser-detail-key">
                        Rank by size
                      </span>
                      <span className="party-browser-detail-val">
                        #{p.rank}
                        <span className="party-browser-detail-sub">
                          {" of "}
                          {parties.length}
                        </span>
                      </span>
                    </div>
                    <div className="party-browser-detail-cell">
                      <span className="party-browser-detail-key">
                        {p.rank === 1 ? "Lead over 2nd" : "Behind largest"}
                      </span>
                      <span className="party-browser-detail-val">
                        {p.rank === 1 ? (
                          <LeadOverSecond ranked={ranked} />
                        ) : (
                          `${p.gapToLargest} seats`
                        )}
                      </span>
                    </div>
                  </div>
                  {hasCoalitionData && (
                    <div className="party-browser-detail-foot">
                      <span
                        className={`party-browser-status party-browser-status--${
                          p.inCoalition ? "gov" : "opp"
                        }`}
                      >
                        {p.inCoalition
                          ? "Governing coalition"
                          : "Opposition / cross-bench"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Renders the largest party's margin over the second-largest, when known. */
function LeadOverSecond({
  ranked,
}: {
  ranked: Array<{ rank: number; seats: number }>;
}) {
  const first = ranked.find((r) => r.rank === 1);
  const second = ranked.find((r) => r.rank === 2);
  if (!first || !second) return <>—</>;
  const margin = first.seats - second.seats;
  return <>{`+${margin} seats`}</>;
}
