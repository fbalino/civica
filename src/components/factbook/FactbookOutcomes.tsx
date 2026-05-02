import { FactbookOutcomesGraph } from "./FactbookOutcomesGraph";

/**
 * Factbook · Outcomes
 *
 * Thin facade that renders the dense peer-band graph at
 * <FactbookOutcomesGraph>. The legacy `<CountryOutcomeBars>` (the long
 * editorial bars) is intentionally NOT used in factbook — that
 * component still lives on `/countries/[slug]` for its own purposes,
 * but the factbook reader needs the dense graph that fits ~10 rows
 * in the same vertical space.
 *
 * Empty-state handling lives inside `<FactbookOutcomesGraph>` (it
 * returns null when no metrics). The orchestrator already pre-fetches
 * `getCountryOutcomes` for the visibility check, so by the time we
 * render here we know there's data.
 */
export interface FactbookOutcomesProps {
  jurisdictionId: string;
  countryName: string;
  countrySlug: string;
  /** Optional override; defaults to current calendar year. */
  year?: number;
}

export function FactbookOutcomes({
  jurisdictionId,
  countryName,
  year,
}: FactbookOutcomesProps) {
  return (
    <FactbookOutcomesGraph
      jurisdictionId={jurisdictionId}
      countryName={countryName}
      year={year}
    />
  );
}
