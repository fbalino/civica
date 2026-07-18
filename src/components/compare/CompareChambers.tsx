import { FactbookLegislatureChart } from "@/components/factbook/FactbookLegislatureChart";
import { CompareColumnHeader } from "./CompareColumnHeader";
import type { getLegislatureComposition } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { sourceLabel } from "@/lib/data/sources";

type Composition = Awaited<ReturnType<typeof getLegislatureComposition>>;

export interface CompareChambersProps {
  countries: Array<{
    jurisdiction: { slug: string; name: string; iso2: string | null };
    chambers: Composition;
    seriesColor: string;
  }>;
}

function classifyChamber(
  body: Composition[number]["body"]
): "upper" | "lower" | "unicameral" | "other" {
  const name = (body.chamberType ?? "").toLowerCase();
  if (name === "upper" || name === "lower" || name === "unicameral") return name;
  return "other";
}

function toCanonicalChamber(
  entry: Composition[number],
  fallbackSlot: "lower" | "upper"
) {
  const total =
    entry.body.totalSeats ??
    entry.parties.reduce((sum, party) => sum + (party.seatCount ?? 0), 0);

  return {
    id: entry.body.id,
    slot: fallbackSlot,
    name: entry.body.name,
    total,
    sub: `${total} seats`,
    parties: entry.parties.map((party) => ({
      id: party.id,
      name: party.partyName,
      seats: party.seatCount ?? 0,
      color: party.partyColor ?? "var(--color-text-40)",
    })),
  };
}

function compositionProvenance(entry: Composition[number]) {
  const sources = entry.compositionSources;
  if (sources.length === 0) {
    return (
      <p className="compare-chamber-provenance">
        No source-bound composition release is recorded for this chamber. This
        is a provenance gap, not evidence that the chamber has no seats.
      </p>
    );
  }

  return (
    <ul className="compare-chamber-provenance" aria-label="Chamber composition provenance">
      {sources.map((source) => {
        const retrievedAt = source.sourceRetrievedAt
          ? source.sourceRetrievedAt.toISOString()
          : null;
        return (
          <li key={source.runKey}>
            {source.sourceId ? (
              <>
                <SourceDot source={source.sourceId} retrievedAt={retrievedAt} />
                {" "}
                {source.sourceUrl ? (
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                    {sourceLabel(source.sourceId)} composition release
                  </a>
                ) : (
                  `${sourceLabel(source.sourceId)} composition release`
                )}
              </>
            ) : (
              "Composition release has no registered source identity"
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CompareChambers({ countries }: CompareChambersProps) {
  if (countries.length === 0) return null;

  const colCount = countries.length;

  return (
    <div
      className="compare-chambers-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        gap: 16,
      }}
    >
      {countries.map((c) => {
        const lower = c.chambers.find(
          (b) => classifyChamber(b.body) === "lower" || classifyChamber(b.body) === "unicameral"
        ) ?? c.chambers[0];
        const upper = c.chambers.find(
          (b) => classifyChamber(b.body) === "upper"
        );

        return (
          <div
            key={c.jurisdiction.slug}
            className="compare-chamber-col"
          >
            <CompareColumnHeader
              slug={c.jurisdiction.slug}
              name={c.jurisdiction.name}
              iso2={c.jurisdiction.iso2}
              seriesColor={c.seriesColor}
            />

            {lower ? (
              <div className="compare-chamber-block">
                <div className="compare-chamber-eyebrow">
                  {classifyChamber(lower.body) === "unicameral"
                    ? "LEGISLATURE"
                    : "LOWER CHAMBER"}
                </div>
                <FactbookLegislatureChart
                  chamber={toCanonicalChamber(lower, "lower")}
                  houseLabel={
                    classifyChamber(lower.body) === "unicameral"
                      ? "Legislature"
                      : "Lower house"
                  }
                  countryName={c.jurisdiction.name}
                />
                {compositionProvenance(lower)}
              </div>
            ) : (
              <div className="compare-chamber-placeholder">
                Chamber composition data not yet available
              </div>
            )}

            {upper && (
              <div className="compare-chamber-block">
                <div className="compare-chamber-eyebrow">UPPER CHAMBER</div>
                <FactbookLegislatureChart
                  chamber={toCanonicalChamber(upper, "upper")}
                  houseLabel="Upper house"
                  countryName={c.jurisdiction.name}
                />
                {compositionProvenance(upper)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
