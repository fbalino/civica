import type { LegislatureChamber } from "@/lib/factbook/legislature";
import type { ChamberCoalition } from "@/lib/db/queries-legislature";

/**
 * Composition summary that sits ABOVE the canonical hemicycle for one chamber.
 *
 * Two source-backed blocks, each rendered only when its data exists:
 *
 *  1. A government / opposition balance bar — ONLY when the chamber has
 *     `is_ruling_coalition` flags (≈9 bodies today). It splits the chamber
 *     into governing-coalition seats vs the remainder and states whether the
 *     coalition holds a working majority. Skipped (not faked) otherwise.
 *
 *  2. A "concentration" read — the largest party's share and the combined
 *     share of the top two parties. These are pure arithmetic over the seat
 *     counts that every party row already carries, so they're always honest.
 *
 * No invented totals: when `chamber.total` is 0 or parties are absent the
 * component returns null and the parent simply shows the hemicycle alone.
 */

interface ChamberCompositionProps {
  chamber: LegislatureChamber;
  coalition: ChamberCoalition | null;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function ChamberComposition({
  chamber,
  coalition,
}: ChamberCompositionProps) {
  const total = chamber.total;
  if (total <= 0 || chamber.parties.length === 0) return null;

  const sorted = [...chamber.parties].sort((a, b) => b.seats - a.seats);
  const largest = sorted[0];
  const second = sorted[1];
  const largestShare = (largest.seats / total) * 100;
  const topTwoShare =
    ((largest.seats + (second?.seats ?? 0)) / total) * 100;
  // Same formula as the canonical hemicycle (FactbookLegislatureChart) so a
  // single chamber never shows two different majority numbers.
  const majorityLine = Math.ceil(total / 2) + 1;

  // Coalition block is only meaningful when seats are flagged AND don't exceed
  // the chamber total (guards against an aggregation artefact).
  const coalitionSeats =
    coalition && coalition.coalitionSeats > 0 && coalition.coalitionSeats <= total
      ? coalition.coalitionSeats
      : null;
  const coalitionShare =
    coalitionSeats != null ? (coalitionSeats / total) * 100 : null;
  const hasMajority =
    coalitionSeats != null ? coalitionSeats >= majorityLine : null;

  return (
    <div className="chamber-comp">
      {coalitionSeats != null && coalitionShare != null && (
        <div className="chamber-comp-balance">
          <div className="chamber-comp-balance-head">
            <span className="chamber-comp-balance-label">
              Government / opposition
            </span>
            <span
              className={`chamber-comp-majority${
                hasMajority ? " is-maj" : " is-min"
              }`}
            >
              {hasMajority ? "Working majority" : "No single-bloc majority"}
            </span>
          </div>
          <div
            className="chamber-comp-bar"
            role="img"
            aria-label={`Governing coalition holds ${coalitionSeats} of ${total} seats (${fmtPct(
              coalitionShare
            )}). Majority line at ${majorityLine}.`}
          >
            <div
              className="chamber-comp-bar-gov"
              style={{ width: `${coalitionShare.toFixed(2)}%` }}
            />
            <div
              className="chamber-comp-bar-maj"
              style={{ left: `${((majorityLine / total) * 100).toFixed(2)}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="chamber-comp-balance-legend">
            <span className="chamber-comp-leg chamber-comp-leg--gov">
              Governing coalition
              <strong>
                {coalitionSeats} · {fmtPct(coalitionShare)}
              </strong>
              {coalition && coalition.coalitionPartyCount > 1 && (
                <span className="chamber-comp-leg-sub">
                  {coalition.coalitionPartyCount} parties
                </span>
              )}
            </span>
            <span className="chamber-comp-leg chamber-comp-leg--opp">
              Opposition / cross-bench
              <strong>
                {total - coalitionSeats} · {fmtPct(100 - coalitionShare)}
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="chamber-comp-concentration">
        <div className="chamber-comp-conc-cell">
          <span className="chamber-comp-conc-key">Largest party</span>
          <span className="chamber-comp-conc-val">{largest.name}</span>
          <span className="chamber-comp-conc-sub">
            {largest.seats} seats · {fmtPct(largestShare)}
          </span>
        </div>
        {second && (
          <div className="chamber-comp-conc-cell">
            <span className="chamber-comp-conc-key">Top two combined</span>
            <span className="chamber-comp-conc-val">{fmtPct(topTwoShare)}</span>
            <span className="chamber-comp-conc-sub">
              {largest.seats + second.seats} of {total} seats
            </span>
          </div>
        )}
        <div className="chamber-comp-conc-cell">
          <span className="chamber-comp-conc-key">Majority line</span>
          <span className="chamber-comp-conc-val">{majorityLine}</span>
          <span className="chamber-comp-conc-sub">of {total} seats</span>
        </div>
      </div>
    </div>
  );
}
