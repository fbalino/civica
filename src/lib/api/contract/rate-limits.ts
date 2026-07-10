/**
 * CLM-012 — single source for the bulk-export rate-limit numbers.
 *
 * `src/app/api/countries/[slug]/export/route.ts` and
 * `contract/registry.ts` (the documented contract `api-docs` renders
 * from) both import these constants rather than each hand-typing
 * "30" / "60000" independently, so the docs and the runtime can never
 * drift apart.
 */

export const EXPORT_RATE_LIMIT_MAX = 30;
export const EXPORT_RATE_LIMIT_WINDOW_MS = 60_000;
