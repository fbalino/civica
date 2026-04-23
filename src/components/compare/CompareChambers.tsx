import { HemicycleChart } from "@/components/HemicycleChart";
import { CompareColumnHeader } from "./CompareColumnHeader";
import type { getLegislatureComposition } from "@/lib/db/queries";

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
                <HemicycleChart
                  totalSeats={lower.body.totalSeats ?? 0}
                  parties={lower.parties.map((p) => ({
                    name: p.partyName,
                    seats: p.seatCount ?? 0,
                    color: p.partyColor ?? "#888",
                  }))}
                  chamberName={lower.body.name}
                />
                <ChamberMetadata
                  majoritySeats={
                    lower.body.totalSeats
                      ? Math.floor(lower.body.totalSeats / 2) + 1
                      : null
                  }
                  totalSeats={lower.body.totalSeats ?? 0}
                  parties={lower.parties.length}
                />
              </div>
            ) : (
              <div className="compare-chamber-placeholder">
                Chamber composition data not yet available
              </div>
            )}

            {upper && (
              <div className="compare-chamber-block">
                <div className="compare-chamber-eyebrow">UPPER CHAMBER</div>
                <HemicycleChart
                  totalSeats={upper.body.totalSeats ?? 0}
                  parties={upper.parties.map((p) => ({
                    name: p.partyName,
                    seats: p.seatCount ?? 0,
                    color: p.partyColor ?? "#888",
                  }))}
                  chamberName={upper.body.name}
                />
                <ChamberMetadata
                  majoritySeats={
                    upper.body.totalSeats
                      ? Math.floor(upper.body.totalSeats / 2) + 1
                      : null
                  }
                  totalSeats={upper.body.totalSeats ?? 0}
                  parties={upper.parties.length}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChamberMetadata({
  majoritySeats,
  totalSeats,
  parties,
}: {
  majoritySeats: number | null;
  totalSeats: number;
  parties: number;
}) {
  return (
    <div className="compare-chamber-meta">
      <span>
        <strong>{totalSeats}</strong> seats
      </span>
      {majoritySeats && (
        <span>
          Majority: <strong>{majoritySeats}</strong>
        </span>
      )}
      <span>
        <strong>{parties}</strong> {parties === 1 ? "party" : "parties"}
      </span>
    </div>
  );
}
