import { SourceDot } from "@/components/SourceDot";
import { GovernmentTaxonomyBlock } from "@/components/GovernmentTaxonomyBlock";
import { formatGovernmentType } from "@/lib/text/clean";
import type { getGovernmentStructure } from "@/lib/db/queries";
import type { GovernmentClassification } from "@/lib/government-taxonomy";
import { CompareColumnHeader } from "./CompareColumnHeader";

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

interface Jurisdiction {
  slug: string;
  name: string;
  iso2: string | null;
  population: number | null;
  gdpBillions: number | null;
  areaSqKm: number | null;
  languages: string | null;
  currency: string | null;
  capital: string | null;
  governmentType: string | null;
  governmentTypeDetail: string | null;
  democracyIndex: number | null;
  continent: string | null;
  governmentClassification?: GovernmentClassification | null;
}

interface CompareOverviewProps {
  countries: Array<{
    jurisdiction: Jurisdiction;
    govStructure: Awaited<ReturnType<typeof getGovernmentStructure>>;
    seriesColor: string;
  }>;
}

const isQid = (name: string) => /^Q\d+$/.test(name);

function extractLeader(
  gs: Awaited<ReturnType<typeof getGovernmentStructure>>,
  officeType: "head_of_state" | "head_of_government"
): string | null {
  const term = gs.currentTerms.find(
    (t) =>
      gs.offices.find((o) => o.id === t.term.officeId)?.officeType ===
        officeType && !isQid(t.person.name)
  );
  return term?.person.name ?? null;
}

interface Row {
  label: string;
  values: (string | null)[];
  numericValues?: (number | null)[];
  source?: string;
}

export function CompareOverview({ countries }: CompareOverviewProps) {
  if (countries.length === 0) return null;

  const rows: Row[] = [
    {
      label: "Capital",
      values: countries.map((c) => c.jurisdiction.capital),
    },
    {
      label: "Continent",
      values: countries.map((c) => c.jurisdiction.continent),
    },
    {
      label: "Population",
      values: countries.map((c) =>
        c.jurisdiction.population ? formatNumber(c.jurisdiction.population) : null
      ),
      numericValues: countries.map((c) => c.jurisdiction.population),
    },
    {
      label: "GDP",
      values: countries.map((c) =>
        c.jurisdiction.gdpBillions ? `$${c.jurisdiction.gdpBillions.toFixed(1)}B` : null
      ),
      numericValues: countries.map((c) => c.jurisdiction.gdpBillions),
    },
    {
      label: "Area",
      values: countries.map((c) =>
        c.jurisdiction.areaSqKm
          ? `${c.jurisdiction.areaSqKm.toLocaleString()} km²`
          : null
      ),
      numericValues: countries.map((c) => c.jurisdiction.areaSqKm),
    },
    {
      label: "Languages",
      values: countries.map((c) => c.jurisdiction.languages),
    },
    {
      label: "Currency",
      values: countries.map((c) => c.jurisdiction.currency),
    },
    {
      label: "Government",
      values: countries.map((c) =>
        formatGovernmentType(
          c.jurisdiction.governmentTypeDetail ?? c.jurisdiction.governmentType
        )
      ),
    },
    {
      label: "Democracy Index",
      values: countries.map((c) =>
        c.jurisdiction.democracyIndex ? c.jurisdiction.democracyIndex.toFixed(2) : null
      ),
      numericValues: countries.map((c) => c.jurisdiction.democracyIndex),
    },
    {
      label: "Head of State",
      values: countries.map((c) => extractLeader(c.govStructure, "head_of_state")),
      source: "wikidata",
    },
    {
      label: "Head of Government",
      values: countries.map((c) => extractLeader(c.govStructure, "head_of_government")),
      source: "wikidata",
    },
  ];

  const colCount = countries.length;
  const gridColumns = `140px repeat(${colCount}, minmax(160px, 1fr))`;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        className="compare-overview-grid"
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: 1,
          background: "var(--color-grid-bg)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          minWidth: 140 + colCount * 180,
        }}
      >
        <div style={{ background: "var(--color-card-bg)", padding: 16 }} />
        {countries.map((c) => (
          <div
            key={c.jurisdiction.slug}
            style={{ background: "var(--color-card-bg)", padding: 16 }}
          >
            <CompareColumnHeader
              slug={c.jurisdiction.slug}
              name={c.jurisdiction.name}
              iso2={c.jurisdiction.iso2}
              seriesColor={c.seriesColor}
            />
          </div>
        ))}

        {rows.map((row) => {
          const hasAny = row.values.some((v) => v != null);
          if (!hasAny) return null;
          let maxIdx = -1;
          if (row.numericValues) {
            let maxVal = -Infinity;
            row.numericValues.forEach((val, idx) => {
              if (val != null && val > maxVal) {
                maxVal = val;
                maxIdx = idx;
              }
            });
          }

          return [
            <div
              key={`${row.label}-label`}
              style={{
                background: "var(--color-bg)",
                padding: 16,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                {row.label}
              </span>
            </div>,
            ...row.values.map((val, i) => (
              <div
                key={`${row.label}-${i}`}
                style={{
                  background: "var(--color-bg)",
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-13)",
                    color:
                      maxIdx === i && row.numericValues
                        ? "var(--color-accent)"
                        : "var(--color-text-primary)",
                    fontWeight:
                      maxIdx === i && row.numericValues ? 500 : 400,
                    textAlign: "center",
                  }}
                >
                  {val ?? "—"}
                </span>
                {val && row.source && (
                  <SourceDot source={row.source} retrievedAt={null} />
                )}
              </div>
            )),
          ];
        })}

        {/* Government taxonomy block row — full-width per column */}
        <div
          style={{
            background: "var(--color-bg)",
            padding: 16,
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-wide)",
            }}
          >
            Taxonomy
          </span>
        </div>
        {countries.map((c) => (
          <div
            key={`taxonomy-${c.jurisdiction.slug}`}
            style={{
              background: "var(--color-bg)",
              padding: 16,
              display: "flex",
              alignItems: "flex-start",
            }}
          >
            <GovernmentTaxonomyBlock
              classification={c.jurisdiction.governmentClassification}
              compact
              showTitle={false}
              showNote={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
