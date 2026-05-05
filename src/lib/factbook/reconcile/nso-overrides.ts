/**
 * NSO-priority-tier patch — resolver v0.1 (R.13–R.20).
 *
 * For Eurozone NSOs (France, Germany, future Italy/Spain), Eurostat
 * republishes the national agency's number within weeks at the same
 * `as_of` reference period. The resolver's Group B sort puts NSO and
 * Tier-1 publishers at the same `sourcePriority` — tied-date races are
 * non-deterministic (depend on row insertion order). For Eurozone NSOs,
 * ties are the COMMON case, not rare. This map makes the NSO win tied-date
 * races for its own country, deterministically.
 *
 * Resolution docs:
 *   - R.13  ~/civica/plan/us-census-resolution-v1.md  §2d (Option B)
 *   - R.14  ~/civica/plan/ons-uk-resolution-v1.md
 *   - R.15  ~/civica/plan/insee-fr-resolution-v1.md  §"Eurostat coexistence handling"
 *   - R.16–R.20  forthcoming in Waves 2–3
 *
 * Adding entries here is harmless before the corresponding NSO sync
 * ships — `isNsoForJurisdiction()` checks against `r.sourceId`, which
 * won't match any allowlisted source until the sync exists.
 */

/**
 * Map of ISO-3166-1 alpha-3 → NSO source ID.
 *
 * The NSO for a given country gets priority=0 (best) in the resolver's
 * tiebreak; Tier-1 publishers (World Bank, IMF, UN, OECD, Eurostat, …)
 * drop to priority=1 for that country only.  For all other countries,
 * NSOs don't appear (they only sync their own country's rows), so this
 * tiebreak is a no-op for non-NSO countries.
 *
 * Updated as NSO phases land:
 *   Wave 1 (R.13–R.15) — USA, GBR, FRA
 *   Wave 2 (R.16–R.17) — DEU, CAN
 *   Wave 3 (R.18–R.20) — BRA, ZAF, NGA
 */
export const NSO_SOURCE_BY_ISO3: Readonly<Record<string, string>> = {
  USA: "us_census",    // R.13 (Wave 1)
  GBR: "ons_uk",      // R.14 (Wave 1)
  FRA: "insee_fr",    // R.15 (Wave 1)
  DEU: "destatis_de", // R.16 (Wave 2)
  CAN: "statcan_ca",  // R.17 (Wave 2)
  BRA: "ibge_br",     // R.18 (Wave 2 / Wave 3)
  ZAF: "stats_sa",    // R.19 (Wave 3)
  NGA: "nbs_nigeria", // R.20 (Wave 3)
};

/**
 * Returns true when `sourceId` is the authoritative NSO for the
 * jurisdiction identified by `jurisdictionIso3`.
 *
 * This is intentionally strict: an NSO only wins its own country's rows.
 * If `jurisdictionIso3` is null/undefined (test fixtures, non-sovereign
 * territories), the function returns false and the tiebreak is a no-op.
 */
export function isNsoForJurisdiction(
  sourceId: string,
  jurisdictionIso3: string | null | undefined,
): boolean {
  if (!jurisdictionIso3) return false;
  return NSO_SOURCE_BY_ISO3[jurisdictionIso3] === sourceId;
}
