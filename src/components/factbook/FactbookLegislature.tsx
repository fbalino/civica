import { getLegislatureForJurisdiction } from "@/lib/factbook/legislature";
import { FactbookLegislatureChart } from "./FactbookLegislatureChart";

export interface FactbookLegislatureProps {
  jurisdictionId: string;
  countryName: string;
}

/**
 * Factbook Legislature section.
 *
 * Server component that fetches the country's chamber composition from
 * the same `governmentBodies` + `legislatureParties` tables that power
 * the atlas Chamber tab, then hands the data off to the client-side
 * `<FactbookLegislatureChart>` for the interactive hemicycle.
 *
 * Returns `null` when the country has no legislative bodies (Vatican,
 * absolute monarchies with no legislature ingested) so the parent
 * orchestrator hides the section entirely.
 *
 * Bicameral countries render BOTH chambers (lower then upper), separated
 * by a thin labelled divider. Unicameral countries render one chamber.
 */
export async function FactbookLegislature({
  jurisdictionId,
  countryName,
}: FactbookLegislatureProps) {
  const data = await getLegislatureForJurisdiction(jurisdictionId).catch(
    () => null
  );

  if (!data) return null;

  const isBicameral = !!data.upper;
  const lowerLabel = isBicameral ? "Lower house" : "Legislature";

  return (
    <div className="factbook-legislature">
      <FactbookLegislatureChart
        chamber={data.lower}
        houseLabel={lowerLabel}
        countryName={countryName}
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
