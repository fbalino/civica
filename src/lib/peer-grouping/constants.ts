/**
 * Peer-grouping pure constants — no database import.
 *
 * Split out of `src/lib/peer-grouping/index.ts` (CLM-009 §C) because
 * that module imports `@/lib/db` and `@/lib/factbook/reconcile/api`,
 * which `src/lib/content/site-state.ts` must never pull in (site-state
 * is read by DB-free build-time/validator code such as
 * `scripts/validate-content-templates.ts`). Values here are re-exported
 * from `index.ts` for existing call sites, and imported directly by
 * `site-state.ts` so the methodology markdown can interpolate the
 * minimum-n rule instead of hardcoding it.
 */

/** The default minimum-n threshold for rendering a peer band. */
export const DEFAULT_MIN_N = 8;
