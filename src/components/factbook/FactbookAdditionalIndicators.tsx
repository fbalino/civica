/**
 * Factbook · Additional Indicators
 *
 * Phase R.13 — NSO Wave 1, first phase.
 *
 * The home for any Civica-curated reader-facing fact-key that does NOT
 * map to a CIA Factbook prose group. This is where new fact-keys
 * declared at NSO ship time (R.13–R.20) and any future Civica-asserted
 * indicators surface in the structured factbook page.
 *
 * Architectural intent (per user 2026-05-05): mid-page placement was
 * explicitly rejected — would pretend to be another CIA section.
 * Header-strip stuffing was explicitly rejected — header strip is for
 * the canonical Pop + GDP only. Bottom-of-page placement (after all
 * CIA-derived sections, after Scores & Rankings) is locked in
 * `SECTION_PLAN` of `(reader)/factbook/[slug]/page.tsx`.
 *
 * R.13 first row: `median_household_income_usd` for the United States
 * (ACS 1-Year Profile DP03_0062E). Per
 * `~/civica/plan/us-census-resolution-v1.md` §2c.4.
 *
 * Visibility: returns null when the resolver returned no canonical row
 * for any of the configured fact-keys. The orchestrator
 * (`(reader)/factbook/[slug]/page.tsx`) computes this visibility flag
 * up-front so the sidebar + right rail don't list a phantom anchor.
 *
 * Visual contract: matches `<CanonicalLeafRow>` from `FactbookSection`
 * — same `<dt>/<dd>` shape, same tokens, same `<FactValueDot>` source
 * dot. Renders inside a single `<dl>` so the rows look like a normal
 * factbook fact list.
 */

import type { ResolverOutput } from "@/lib/factbook/reconcile/types";
import { FactValueDot } from "./FactValueDot";
import { formatFactRowValue } from "./FactValuePanel";

/**
 * Configuration for one row in the Additional Indicators section.
 * Each row is gated on a resolver fact-key — the row only renders
 * when the resolver returned a canonical row for that key.
 */
export interface AdditionalIndicatorRow {
  /** Phase F fact-key (must exist in `fact-keys.ts`). */
  factKey: string;
  /** Reader-facing label. Sentence-case, no trailing period. */
  label: string;
}

/**
 * The fact-keys surfaced in the Additional Indicators section.
 *
 * R.13 first row: median household income (US Census ACS 1-Year for
 * the USA; future R.14–R.20 NSOs will populate this fact-key for
 * their respective countries).
 *
 * Adding a new row: declare the fact-key in `fact-keys.ts`, ensure a
 * sync writes to it, and add an entry below. The orchestrator's
 * `getCanonicalFactsForJurisdiction()` batch fetch must also include
 * the new fact-key — see the comment in
 * `(reader)/factbook/[slug]/page.tsx`.
 */
export const ADDITIONAL_INDICATOR_ROWS: readonly AdditionalIndicatorRow[] = [
  {
    factKey: "median_household_income_usd",
    label: "Median household income",
  },
];

export interface FactbookAdditionalIndicatorsProps {
  /** Resolver outputs keyed by Phase F fact-key. The orchestrator
   *  passes the same `headerFacts` map it uses for the rest of the
   *  page — Additional Indicators reuses fact-keys already in the
   *  batch. */
  resolverFacts: Record<string, ResolverOutput>;
}

/**
 * True when at least one of the configured rows has a canonical row.
 * Used by the orchestrator to decide whether to render the section
 * + sidebar entry.
 */
export function hasAdditionalIndicators(
  resolverFacts: Record<string, ResolverOutput>,
): boolean {
  return ADDITIONAL_INDICATOR_ROWS.some((row) => {
    const out = resolverFacts[row.factKey];
    return out?.canonical != null;
  });
}

export function FactbookAdditionalIndicators({
  resolverFacts,
}: FactbookAdditionalIndicatorsProps) {
  const visibleRows = ADDITIONAL_INDICATOR_ROWS.filter(
    (row) => resolverFacts[row.factKey]?.canonical != null,
  );
  if (visibleRows.length === 0) return null;

  return (
    <dl style={{ margin: 0 }}>
      {visibleRows.map((row) => {
        const resolverOutput = resolverFacts[row.factKey];
        const canonical = resolverOutput.canonical;
        if (!canonical) return null;
        const value = formatFactRowValue(canonical, row.factKey);
        return (
          <div
            key={row.factKey}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid var(--color-stat-border)",
            }}
          >
            <dt
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-13)",
                color: "var(--color-text-40)",
                marginBottom: 4,
              }}
            >
              {row.label}
            </dt>
            <dd
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-15)",
                lineHeight: "var(--leading-relaxed)",
                color: "var(--color-text-85)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                flexWrap: "wrap",
              }}
            >
              <span>{value}</span>
              <FactValueDot
                factKey={row.factKey}
                factLabel={row.label}
                resolverOutput={resolverOutput}
                canonicalSourceId={canonical.sourceId ?? null}
                ariaLabel={`${row.label}, see all sources`}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
