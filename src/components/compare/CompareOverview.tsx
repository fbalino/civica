import { SourceDot } from "@/components/SourceDot";
import { GovernmentTaxonomyBlock } from "@/components/GovernmentTaxonomyBlock";
import { formatGovernmentType } from "@/lib/text/clean";
import type { getGovernmentStructure } from "@/lib/db/queries";
import type { GovernmentClassification } from "@/lib/government-taxonomy";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import { CompareColumnHeader } from "./CompareColumnHeader";

/**
 * Shared population/large-number formatter. Exported so the /compare
 * picker cards and the overview row format the same resolver-canonical
 * value identically — otherwise the picker and the table below it
 * disagree on a country's population.
 */
export function formatNumber(n: number): string {
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
    /**
     * Phase F.4 — resolver outputs keyed by fact-key for this country.
     * When a fact has a `canonical` row, the row is rendered with a
     * `<FactValueDot>` next to the value so the alternates panel is one
     * click away. When absent (e.g. capital not yet synced), we fall
     * back to the legacy `jurisdictions` cache value with no dot.
     */
    facts?: Record<string, ResolverOutput>;
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
  /**
   * Phase F.4 — when set, we look up `facts[factKey]` per country and
   * render a `<FactValueDot>` for any column where the resolver
   * returned a canonical row.
   */
  factKey?: string;
}

/**
 * Phase F.4 — resolver canonical takes precedence over the legacy
 * `jurisdictions` cache when both exist. Mirrors the public-API
 * contract at /api/v1/countries/[code].
 */
function resolverText(facts: Record<string, ResolverOutput> | undefined, factKey: string): string | null {
  return facts?.[factKey]?.canonical?.factValue ?? null;
}
function resolverNumber(facts: Record<string, ResolverOutput> | undefined, factKey: string): number | null {
  return facts?.[factKey]?.canonical?.factValueNumeric ?? null;
}

export function CompareOverview({ countries }: CompareOverviewProps) {
  if (countries.length === 0) return null;

  // Resolved values per country — resolver canonical → legacy cache.
  const resolved = countries.map((c) => {
    const f = c.facts;
    const popN = resolverNumber(f, "population_total") ?? c.jurisdiction.population;
    const gdpN = resolverNumber(f, "gdp_ppp_usd_billions") ?? c.jurisdiction.gdpBillions;
    const areaN = resolverNumber(f, "area_total_km2") ?? c.jurisdiction.areaSqKm;
    const cap = resolverText(f, "capital") ?? c.jurisdiction.capital;
    const langs = resolverText(f, "official_languages") ?? c.jurisdiction.languages;
    const curr = resolverText(f, "currency_code") ?? c.jurisdiction.currency;
    return { popN, gdpN, areaN, cap, langs, curr };
  });

  const rows: Row[] = [
    {
      label: "Capital",
      values: resolved.map((r) => r.cap),
      factKey: "capital",
    },
    {
      label: "Continent",
      values: countries.map((c) => c.jurisdiction.continent),
    },
    {
      label: "Population",
      values: resolved.map((r) => (r.popN != null ? formatNumber(r.popN) : null)),
      numericValues: resolved.map((r) => r.popN),
      factKey: "population_total",
    },
    {
      label: "GDP",
      values: resolved.map((r) => (r.gdpN != null ? `$${r.gdpN.toFixed(1)}B` : null)),
      numericValues: resolved.map((r) => r.gdpN),
      factKey: "gdp_ppp_usd_billions",
    },
    {
      label: "Area",
      values: resolved.map((r) =>
        r.areaN != null ? `${r.areaN.toLocaleString()} km²` : null,
      ),
      numericValues: resolved.map((r) => r.areaN),
      factKey: "area_total_km2",
    },
    {
      label: "Languages",
      values: resolved.map((r) => r.langs),
      factKey: "official_languages",
    },
    {
      label: "Currency",
      values: resolved.map((r) => r.curr),
      factKey: "currency_code",
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
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-30)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                {row.label}
              </span>
            </div>,
            ...row.values.map((val, i) => {
              const country = countries[i];
              const fact = row.factKey ? country?.facts?.[row.factKey] : null;
              const hasCanonical = fact?.canonical != null;
              return (
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
                      fontSize: "var(--text-14)",
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
                  {val && row.factKey && hasCanonical && fact ? (
                    <FactValueDot
                      factKey={row.factKey}
                      factLabel={row.label}
                      resolverOutput={fact}
                      canonicalSourceId={fact.canonical?.sourceId ?? null}
                      ariaLabel={`${row.label} ${val}, see sources`}
                    />
                  ) : null}
                  {val && row.source && !hasCanonical && (
                    <SourceDot source={row.source} retrievedAt={null} />
                  )}
                </div>
              );
            }),
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
              fontSize: "var(--text-12)",
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
