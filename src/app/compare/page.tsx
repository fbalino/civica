import { Suspense } from "react";
import {
  getAllJurisdictions,
  getJurisdictionsBySlugs,
  getCountryFacts,
  getGovernmentStructure,
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { CompareSelector } from "./selector";

export const metadata = {
  title: "Compare — Civica",
  description: "Compare countries side by side across key indicators.",
};

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

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
    <div className="wide-container py-[var(--spacing-section)]">
      <h1 className="font-heading text-4xl font-normal tracking-tight mb-2">
        Compare
      </h1>
      <p className="font-mono text-xs text-[var(--color-text-tertiary)] mb-8">
        Select up to three countries to compare side by side.
      </p>

      <Suspense fallback={null}>
        <CompareSelector countries={countryList} />
      </Suspense>

      {selected.length >= 2 && (
        <>
          {/* Country headers */}
          <div
            className="grid gap-px mb-px rounded-t-[var(--radius-sm)] overflow-hidden"
            style={{
              gridTemplateColumns: `160px repeat(${colCount}, 1fr)`,
              background: "var(--color-border)",
            }}
          >
            <div className="bg-[var(--color-surface-alt)] p-4" />
            {selected.map((country) => (
              <div key={country.slug} className="bg-[var(--color-surface-alt)] p-4 text-center">
                <span className="text-[32px] block mb-2">
                  {countryFlag(country.iso2)}
                </span>
                <a
                  href={`/countries/${country.slug}`}
                  className="font-heading text-xl font-normal text-[var(--color-text-primary)] hover:text-[var(--color-accent-text)] transition-colors no-underline"
                >
                  {country.name}
                </a>
              </div>
            ))}
          </div>

          {/* Data rows */}
          <div
            className="grid gap-px rounded-b-[var(--radius-sm)] overflow-hidden"
            style={{
              gridTemplateColumns: `160px repeat(${colCount}, 1fr)`,
              background: "var(--color-border)",
            }}
          >
            {/* Profile rows */}
            {rows.map((row) => {
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
                  className="bg-[var(--color-surface)] p-4 flex items-center"
                >
                  <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    {row.label}
                  </span>
                </div>,
                ...row.values.map((val, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className="bg-[var(--color-surface)] p-4 flex items-center justify-center"
                  >
                    <span
                      className={`font-mono text-[13px] ${
                        maxIdx === i && row.numericValues
                          ? "text-[var(--color-accent-text)] font-medium"
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {val ?? "\u2014"}
                    </span>
                  </div>
                )),
              ];
            })}

            {/* Leadership rows */}
            {leaderRows.map((row) => {
              const hasAny = row.values.some((v) => v != null);
              if (!hasAny) return null;
              return [
                <div
                  key={`${row.label}-label`}
                  className="bg-[var(--color-surface)] p-4 flex items-center"
                >
                  <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-wide">
                    {row.label}
                  </span>
                </div>,
                ...row.values.map((val, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className="bg-[var(--color-surface)] p-4 flex items-center justify-center"
                  >
                    <span className="font-mono text-[13px] text-[var(--color-text-primary)]">
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
        </>
      )}

      {selected.length === 1 && (
        <p className="text-center font-mono text-sm text-[var(--color-text-tertiary)] py-12">
          Select at least one more country to compare.
        </p>
      )}

      {selected.length === 0 && validSlugs.length === 0 && (
        <p className="text-center font-mono text-sm text-[var(--color-text-tertiary)] py-12">
          Choose countries above to begin comparing.
        </p>
      )}
    </div>
  );
}
