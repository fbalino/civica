import { getCountryOutcomes } from "@/lib/db/queries";
import { CountryOutcomeBars } from "@/components/outcomes/CountryOutcomeBars";

/**
 * Factbook · Outcomes
 *
 * Server-component shim that wires the existing client-side
 * `<CountryOutcomeBars>` into the factbook reader. The bars component
 * fetches its own data via `/api/countries/[slug]/outcomes`, so the
 * shim's job is purely a server-side presence check: when the country
 * has zero outcome metrics we return null and the orchestrator's
 * `visibleSections` filter hides the entire Outcomes section (matching
 * how `FactbookBills` / `FactbookLegislature` behave).
 *
 * `showTrend` is forced to false in the factbook layout because the
 * cleaner reader page deliberately omits the stale-year badge — the
 * page's own provenance strip already surfaces that.
 *
 * Per the AGENTS.md Outcomes-tab decision, no trend column is rendered
 * here. If a future iteration needs trend, flip `showTrend` to true
 * and extend the bars component.
 */
export interface FactbookOutcomesProps {
  jurisdictionId: string;
  countryName: string;
  countrySlug: string;
  /** Optional override; defaults to current calendar year. */
  year?: number;
}

export async function FactbookOutcomes({
  jurisdictionId,
  countryName,
  countrySlug,
  year,
}: FactbookOutcomesProps) {
  const targetYear = year ?? new Date().getFullYear();

  const result = await getCountryOutcomes(jurisdictionId, targetYear).catch(
    () => null
  );

  // Treat any failure as "no outcomes" so the section silently hides
  // rather than 500-ing the entire factbook page.
  if (!result) return null;

  const metricsRaw = Array.isArray(result.metrics)
    ? result.metrics
    : (result.metrics as { rows?: unknown[] })?.rows ?? [];

  if (!metricsRaw || metricsRaw.length === 0) return null;

  return (
    <CountryOutcomeBars
      slug={countrySlug}
      countryName={countryName}
      year={targetYear}
      showTrend={false}
    />
  );
}
