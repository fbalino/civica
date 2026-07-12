import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import {
  getLegislatureContext,
  type ChamberCoalition,
} from "@/lib/db/queries-legislature";
import { SourceDot } from "@/components/SourceDot";
import { Banner } from "@/components/editorial/Banner";
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
  const [dataResult, contextResult] = await Promise.allSettled([
    getLegislatureForJurisdiction(jurisdictionId),
    getLegislatureContext(jurisdictionId),
  ]);
  const compositionUnavailable = dataResult.status === "rejected";
  const electionContextUnavailable = contextResult.status === "rejected";
  const data = dataResult.status === "fulfilled" ? dataResult.value : null;
  const context =
    contextResult.status === "fulfilled" ? contextResult.value : null;

  const isBicameral = Boolean(data?.upper);
  const lowerLabel = isBicameral ? "Lower house" : "Legislature";

  // Match coalition flags to chambers by body id (chamber.id === body id).
  const coalitionByBody = new Map<string, ChamberCoalition>();
  for (const c of context?.coalitions ?? []) {
    coalitionByBody.set(c.bodyId, c);
  }

  const facts = context?.keyFacts;
  const structureLabel = isBicameral ? "Bicameral" : "Unicameral";
  const chamberCount = isBicameral ? "Two chambers" : "One chamber";
  const totalSeatsAcross = data
    ? data.lower.total + (data.upper ? data.upper.total : 0)
    : 0;

  // Build the key-facts strip from whatever is genuinely available.
  const keyFactCells: Array<{
    key: string;
    val: string;
    sub?: string;
  }> = [];
  if (data) {
    keyFactCells.push({
      key: "Structure",
      val: structureLabel,
      sub: chamberCount,
    });
    keyFactCells.push({
      key: "Total seats",
      val: totalSeatsAcross > 0 ? String(totalSeatsAcross) : "—",
      sub: isBicameral ? "across both chambers" : undefined,
    });
  }

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
      key:
        facts.nextElectionBasis === "term_projection"
          ? "Election due estimate"
          : "Future election date",
      val: facts.nextElectionYear,
      sub:
        facts.nextElectionBasis === "term_projection"
          ? "term-length projection"
          : facts.nextElectionStatus === "tentative"
            ? "tentative source date; schedule not independently verified"
            : "source-dated; schedule not independently verified",
    });
  } else if (facts?.lastElectionYear) {
    keyFactCells.push({
      key: "Last election",
      val: facts.lastElectionYear,
      sub: "most recent legislative",
    });
    keyFactCells.push({
      key: "Future election timing",
      val: "Not available",
      sub: "no qualified source date or term-length projection",
    });
  }

  if (facts?.lastElectionResultsStatus) {
    keyFactCells.push({
      key: "Compiled results",
      val:
        facts.lastElectionResultsStatus === "compiled"
          ? "Available"
          : "Not compiled",
      sub: facts.lastElectionName ?? undefined,
    });
  }

  return (
    <div className="factbook-legislature">
      <Banner variant="info">
        Election dates are calendar dates. No time of day or source timezone is
        recorded.
      </Banner>
      {compositionUnavailable ? (
        <Banner variant="warn">
          Chamber composition is temporarily unavailable.
        </Banner>
      ) : !data ? (
        <Banner variant="info">
          No chamber composition is available for {countryName}.
        </Banner>
      ) : null}
      {electionContextUnavailable ? (
        <Banner variant="warn">
          Qualified election context is temporarily unavailable.
        </Banner>
      ) : !facts?.lastElectionYear ? (
        <Banner variant="info">
          No qualified legislative election record is available in this audited
          release.
        </Banner>
      ) : null}
      {/* Key-facts strip — composition + how the legislature is elected. */}
      {keyFactCells.length > 0 && (
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
            {data && (
              <>
                <SourceDot
                  source="ipu_parline"
                  retrievedAt={context?.partySyncAt ?? null}
                />
                <span className="legislature-keyfacts-source-label">
                  Composition · IPU Parline
                </span>
              </>
            )}
            {facts?.electoralSystem && context?.systemEvidence && (
              <>
                <SourceDot
                  source={context.systemEvidence.sourceId}
                  retrievedAt={context.systemEvidence.retrievedAt}
                />
                <span className="legislature-keyfacts-source-label">
                  Electoral system
                </span>
              </>
            )}
            {context?.electionEvidence && (
              <>
                <SourceDot
                  source={context.electionEvidence.sourceId}
                  retrievedAt={context.electionEvidence.retrievedAt}
                />
                <span className="legislature-keyfacts-source-label">
                  Election timing
                </span>
              </>
            )}
            {context?.turnoutEvidence && (
              <>
                <SourceDot
                  source={context.turnoutEvidence.sourceId}
                  retrievedAt={context.turnoutEvidence.retrievedAt}
                />
                <span className="legislature-keyfacts-source-label">
                  Turnout
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {data && (
        <FactbookLegislatureChart
          chamber={data.lower}
          houseLabel={lowerLabel}
          countryName={countryName}
          coalition={coalitionByBody.get(data.lower.id) ?? null}
        />
      )}

      {data?.upper && (
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
      {data && (data.coalition || data.nextElection) && (
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
                Election timing
              </div>
              <div className="factbook-legislature-ribbon-val">
                {data.nextElectionStatus === "tentative"
                  ? data.nextElection.replace(
                      "Source-dated",
                      "Tentative source date",
                    )
                  : data.nextElection}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
