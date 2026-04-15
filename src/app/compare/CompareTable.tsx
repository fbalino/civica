import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";
import type { getGovernmentStructure } from "@/lib/db/queries";

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

interface CompareRow {
  label: string;
  values: (string | null)[];
  numericValues?: (number | null)[];
  source?: string;
}

type Jurisdiction = {
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
};

const COMPARE_FIELDS: {
  label: string;
  getValue: (j: Jurisdiction) => string | null;
  getNumeric?: (j: Jurisdiction) => number | null;
}[] = [
  { label: "Capital", getValue: (j) => j.capital },
  { label: "Continent", getValue: (j) => j.continent },
  {
    label: "Population",
    getValue: (j) => (j.population ? formatNumber(j.population) : null),
    getNumeric: (j) => j.population,
  },
  {
    label: "GDP",
    getValue: (j) => (j.gdpBillions ? `$${j.gdpBillions.toFixed(1)}B` : null),
    getNumeric: (j) => j.gdpBillions,
  },
  {
    label: "Area",
    getValue: (j) =>
      j.areaSqKm ? `${j.areaSqKm.toLocaleString()} km\u00B2` : null,
    getNumeric: (j) => j.areaSqKm,
  },
  { label: "Languages", getValue: (j) => j.languages },
  { label: "Currency", getValue: (j) => j.currency },
  {
    label: "Government",
    getValue: (j) => j.governmentTypeDetail ?? j.governmentType,
  },
  {
    label: "Democracy Index",
    getValue: (j) => (j.democracyIndex ? j.democracyIndex.toFixed(2) : null),
    getNumeric: (j) => j.democracyIndex,
  },
];

export function CompareTable({
  selected,
  govStructures,
}: {
  selected: Jurisdiction[];
  govStructures: Awaited<ReturnType<typeof getGovernmentStructure>>[];
}) {
  const rows: CompareRow[] = COMPARE_FIELDS.map((field) => ({
    label: field.label,
    values: selected.map((j) => field.getValue(j)),
    numericValues: field.getNumeric
      ? selected.map((j) => field.getNumeric!(j))
      : undefined,
  }));

  const leaderRows: CompareRow[] = [];
  if (selected.length > 0) {
    const hosNames = govStructures.map((gs) => {
      const hos = gs.currentTerms.find(
        (t) =>
          gs.offices.find((o) => o.id === t.term.officeId)?.officeType ===
          "head_of_state"
      );
      return hos?.person.name ?? null;
    });
    const hogNames = govStructures.map((gs) => {
      const hog = gs.currentTerms.find(
        (t) =>
          gs.offices.find((o) => o.id === t.term.officeId)?.officeType ===
          "head_of_government"
      );
      return hog?.person.name ?? null;
    });
    leaderRows.push({
      label: "Head of State",
      values: hosNames,
      source: "wikidata",
    });
    leaderRows.push({
      label: "Head of Government",
      values: hogNames,
      source: "wikidata",
    });
  }

  const colCount = selected.length || 1;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `140px repeat(${colCount}, minmax(160px, 1fr))`,
          gap: 1,
          background: "var(--color-grid-bg)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          minWidth: 140 + colCount * 160,
        }}
      >
        <div style={{ background: "var(--color-card-bg)", padding: 16 }} />
        {selected.map((country) => (
          <div
            key={country.slug}
            style={{
              background: "var(--color-card-bg)",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <CountryFlag iso2={country.iso2} size={32} />
            </div>
            <a
              href={`/countries/${country.slug}`}
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-20)",
                fontWeight: 400,
                color: "var(--color-text-primary)",
                textDecoration: "none",
              }}
            >
              {country.name}
            </a>
          </div>
        ))}

        {[...rows, ...leaderRows].map((row) => {
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
                  }}
                >
                  {val ?? "\u2014"}
                  {val && row.source && (
                    <SourceDot source={row.source} retrievedAt="2026-04-13" />
                  )}
                </span>
              </div>
            )),
          ];
        })}
      </div>
    </div>
  );
}
