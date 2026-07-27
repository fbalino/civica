/**
 * BRD-013 — reserved bulk-export rate-limit numbers. Currently UNUSED:
 * neither `src/app/api/countries/[slug]/export/route.ts` nor
 * `contract/registry.ts` imports these constants. The export route's
 * contract entry (`registry.ts`, route id "country-export") declares
 * `rateLimit: null`, and the route itself enforces no per-IP throttle —
 * `src/app/api-docs/page.tsx`'s Rate Limits paragraph states that
 * plainly rather than describing an unenforced limit.
 *
 * If the export route is ever rate-limited, wire these constants into
 * the route handler AND into that registry entry's `rateLimit` field
 * (following the `v1RateLimit` pattern the versioned routes already
 * use) so the docs, the contract, and the runtime cannot drift apart.
 */

export const EXPORT_RATE_LIMIT_MAX = 30;
export const EXPORT_RATE_LIMIT_WINDOW_MS = 60_000;
