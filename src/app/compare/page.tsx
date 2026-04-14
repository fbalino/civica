import { Suspense } from "react";
import {
  getAllJurisdictions,
  getJurisdictionsBySlugs,
  getGovernmentStructure,
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";
import { CompareSelector } from "./selector";

export const metadata = {
  title: "Compare — Civica",
  description: "Compare countries side by side across key indicators.",
};

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

const COMPARE_FIELDS: {
  label: string;
  getValue: (j: { population: number | null; gdpBillions: number | null; areaSqKm: number | null; languages: string | null; currency: string | null; capital: string | null; governmentType: string | null; governmentTypeDetail: string | null; democracyIndex: number | null; continent: string | null }) => string | null;
  getNumeric?: (j: { population: number | null; gdpBillions: number | null; areaSqKm: number | null; democracyIndex: number | null }) => number | null;
}[] = [
  { label: "Capital", getValue: (j) => j.capital },
  { label: "Continent", getValue: (j) => j.continent },
  { label: "Population", getValue: (j) => j.population ? formatNumber(j.population) : null, getNumeric: (j) => j.population },
  { label: "GDP", getValue: (j) => j.gdpBillions ? `$${j.gdpBillions.toFixed(1)}B` : null, getNumeric: (j) => j.gdpBillions },
  { label: "Area", getValue: (j) => j.areaSqKm ? `${j.areaSqKm.toLocaleString()} km\u00B2` : null, getNumeric: (j) => j.areaSqKm },
  { label: "Languages", getValue: (j) => j.languages },
  { label: "Currency", getValue: (j) => j.currency },
  { label: "Government", getValue: (j) => j.governmentTypeDetail ?? j.governmentType },
  { label: "Democracy Index", getValue: (j) => j.democracyIndex ? j.democracyIndex.toFixed(2) : null, getNumeric: (j) => j.democracyIndex },
];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const rawC = resolvedParams?.c;
  const slugs: string[] = Array.isArray(rawC) ? rawC : rawC ? [rawC] : [];
  const validSlugs = slugs.filter((s) => typeof s === "string" && s.length > 0).slice(0, 3);

  let allCountries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allCountries = await getAllJurisdictions();
  } catch {}

  const countryList = allCountries.map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
  }));

  let selected: Awaited<ReturnType<typeof getJurisdictionsBySlugs>> = [];
  let govStructures: Awaited<ReturnType<typeof getGovernmentStructure>>[] = [];

  if (validSlugs.length > 0) {
    try {
      selected = await getJurisdictionsBySlugs(validSlugs);
      selected.sort((a, b) => validSlugs.indexOf(a.slug) - validSlugs.indexOf(b.slug));
      govStructures = await Promise.all(selected.map((s) => getGovernmentStructure(s.id)));
    } catch {}
  }

  const rows: CompareRow[] = COMPARE_FIELDS.map((field) => ({
    label: field.label,
    values: selected.map((j) => field.getValue(j as Parameters<typeof field.getValue>[0])),
    numericValues: field.getNumeric
      ? selected.map((j) => field.getNumeric!(j as Parameters<typeof field.getNumeric>[0]))
      : undefined,
  }));

  const leaderRows: CompareRow[] = [];
  if (selected.length > 0) {
    const hosNames = govStructures.map((gs) => {
      const hos = gs.currentTerms.find(
        (t) => gs.offices.find((o) => o.id === t.term.officeId)?.officeType === "head_of_state"
      );
      return hos?.person.name ?? null;
    });
    const hogNames = govStructures.map((gs) => {
      const hog = gs.currentTerms.find(
        (t) => gs.offices.find((o) => o.id === t.term.officeId)?.officeType === "head_of_government"
      );
      return hog?.person.name ?? null;
    });
    leaderRows.push({ label: "Head of State", values: hosNames, source: "wikidata" });
    leaderRows.push({ label: "Head of Government", values: hogNames, source: "wikidata" });
  }

  const colCount = selected.length || 1;

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "60px var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading">
        Compare
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 32,
        }}
      >
        Select up to three countries to compare side by side.
      </p>

      <Suspense fallback={null}>
        <CompareSelector countries={countryList} />
      </Suspense>

      {selected.length >= 2 && (
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
          {/* Country headers */}
          <div style={{ background: "var(--color-card-bg)", padding: 16 }} />
          {selected.map((country) => (
            <div key={country.slug} style={{ background: "var(--color-card-bg)", padding: 16, textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
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

          {/* Data rows */}
          {[...rows, ...leaderRows].map((row) => {
            const hasAny = row.values.some((v) => v != null);
            if (!hasAny) return null;

            let maxIdx = -1;
            if (row.numericValues) {
              let maxVal = -Infinity;
              row.numericValues.forEach((val, idx) => {
                if (val != null && val > maxVal) { maxVal = val; maxIdx = idx; }
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
                      color: maxIdx === i && row.numericValues ? "var(--color-accent)" : "var(--color-text-primary)",
                      fontWeight: maxIdx === i && row.numericValues ? 500 : 400,
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
      )}

      {selected.length === 1 && (
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-14)", color: "var(--color-text-40)", padding: "48px 0" }}>
          Select at least one more country to compare.
        </p>
      )}

      {selected.length === 0 && validSlugs.length === 0 && (
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-14)", color: "var(--color-text-40)", padding: "48px 0" }}>
          Choose countries above to begin comparing.
        </p>
      )}
    </div>
  );
}
