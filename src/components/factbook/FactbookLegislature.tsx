import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import {
  getLegislatureContext,
  type ChamberCoalition,
} from "@/lib/db/queries-legislature";
import { SourceDot } from "@/components/SourceDot";
import { FactbookLegislatureChart } from "./FactbookLegislatureChart";
import "./legislature.css";

export interface FactbookLegislatureProps {
  jurisdictionId: string;
  countryName: string;
}

/**
 * Factbook Legislature section (deepened Civica Data tab).
 *
 * Server component. Fetches chamber composition from the same
 * `governmentBodies` + `legislatureParties` tables that power the atlas
 * Chamber tab, PLUS a supplementary context query
 * (`getLegislatureContext`) for source-backed extras: electoral system,
 * turnout, scheduled elections, and governing-coalition flags.
 *
 * Layout around the canonical hemicycle:
 *   1. Key-facts strip — composition shape + how the legislature is elected.
 *      Each cell renders only when its datum exists (no fabricated values).
 *   2. Per chamber: <FactbookLegislatureChart> (the canonical hemicycle),
 *      wrapped by a composition summary (gov/opposition bar when flagged) and
 *      followed by the sortable Party Browser.
 *
 * Returns `null` when the country has no legislative bodies (Vatican,
 * absolute monarchies with no legislature ingested) so the parent
 * orchestrator hides the section entirely.
 */
export async function FactbookLegislature({
  jurisdictionId,
  countryName,
}: FactbookLegislatureProps) {
  const [data, context] = await Promise.all([
    getLegislatureForJurisdiction(jurisdictionId).catch(() => null),
    getLegislatureContext(jurisdictionId).catch(() => null),
  ]);

  if (!data) return null;

  const isBicameral = !!data.upper;
  const lowerLabel = isBicameral ? "Lower house" : "Legislature";

  // Match coalition flags to chambers by body id (chamber.id === body id).
  const coalitionByBody = new Map<string, ChamberCoalition>();
  for (const c of context?.coalitions ?? []) {
    coalitionByBody.set(c.bodyId, c);
  }

  const facts = context?.keyFacts;
  const structureLabel = isBicameral ? "Bicameral" : "Unicameral";
  const chamberCount = isBicameral ? "Two chambers" : "One chamber";
  const totalSeatsAcross =
    data.lower.total + (data.upper ? data.upper.total : 0);

  // Build the key-facts strip from whatever is genuinely available.
  const keyFactCells: Array<{
    key: string;
    val: string;
    sub?: string;
  }> = [
    {
      key: "Structure",
      val: structureLabel,
      sub: chamberCount,
    },
    {
      key: "Total seats",
      val: totalSeatsAcross > 0 ? String(totalSeatsAcross) : "—",
      sub: isBicameral ? "across both chambers" : undefined,
    },
  ];

  if (facts?.electoralSystem) {
    keyFactCells.push({
      key: "Electoral system",
      val: facts.electoralSystem,
      sub: facts.lastElectionYear
        ? `as of ${facts.lastElectionYear}`
        : undefined,
    });
  }

  if (facts?.turnoutPercent != null) {
    keyFactCells.push({
      key: "Last turnout",
      val: `${facts.turnoutPercent.toFixed(1)}%`,
      sub: facts.lastElectionYear ?? undefined,
    });
  }

  if (facts?.nextElectionYear) {
    keyFactCells.push({
      key: "Next election",
      val: facts.nextElectionYear,
      sub: "scheduled",
    });
  } else if (facts?.lastElectionYear) {
    keyFactCells.push({
      key: "Last election",
      val: facts.lastElectionYear,
      sub: "most recent legislative",
    });
  }

  return (
    <div className="factbook-legislature">
      {/* Key-facts strip — composition + how the legislature is elected. */}
      <div className="legislature-keyfacts">
        <div className="legislature-keyfacts-grid">
          {keyFactCells.map((cell) => (
            <div className="legislature-keyfact" key={cell.key}>
              <span className="legislature-keyfact-key">{cell.key}</span>
              <span className="legislature-keyfact-val">{cell.val}</span>
              {cell.sub && (
                <span className="legislature-keyfact-sub">{cell.sub}</span>
              )}
            </div>
          ))}
        </div>
        <div className="legislature-keyfacts-source">
          <SourceDot
            source="ipu_parline"
            retrievedAt={context?.partySyncAt ?? null}
          />
          <span className="legislature-keyfacts-source-label">
            Composition · IPU Parline
          </span>
        </div>
      </div>

      <FactbookLegislatureChart
        chamber={data.lower}
        houseLabel={lowerLabel}
        countryName={countryName}
        coalition={coalitionByBody.get(data.lower.id) ?? null}
      />

      {data.upper && (
        <>
          <div
            className="factbook-legislature-divider"
            role="separator"
            aria-label="Upper house"
          >
            <span className="factbook-legislature-divider-label">
              Upper house
            </span>
          </div>
          <FactbookLegislatureChart
            chamber={data.upper}
            houseLabel="Upper house"
            countryName={countryName}
            coalition={coalitionByBody.get(data.upper.id) ?? null}
          />
        </>
      )}

      {/* Coalition + next-election ribbon, only when at least one signal
          exists. Sits below both chambers so it applies to the whole
          legislature, not a single house. */}
      {(data.coalition || data.nextElection) && (
        <div className="factbook-legislature-ribbon">
          {data.coalition && (
            <div className="factbook-legislature-ribbon-cell">
              <div className="factbook-legislature-ribbon-key">
                Ruling coalition
              </div>
              <div className="factbook-legislature-ribbon-val">
                {data.coalition}
              </div>
            </div>
          )}
          {data.nextElection && (
            <div className="factbook-legislature-ribbon-cell">
              <div className="factbook-legislature-ribbon-key">
                Next election
              </div>
              <div className="factbook-legislature-ribbon-val">
                {data.nextElection}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
