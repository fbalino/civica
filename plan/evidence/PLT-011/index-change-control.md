# PLT-011 Index presentation change control

PLT-011 changes the delivery contract around protected Index API responses. It does not change an Index input, transform, weight, missingness rule, uncertainty rule, score, band, rank, or published research value.

## Protected presentation change

The protected governance-evidence route and six protected `/api/v1/index/*` routes now call the same durable, fail-closed request limiter used by the rest of the public API. Their successful and deprecated response envelopes remain unchanged. The API contract now additionally documents the shared `429` limited response and the distinct `503` counter-unavailable response.

The protected API registry records those operational response limits. A closed route-method policy registry and source scanner prevent a future protected route from silently returning to a process-local counter or losing its declared protection.

## Migration and rollback

The existing `rate_limits` relation is reused; PLT-011 does not add or rewrite Index research rows. Production already has an independently generated `RATE_LIMIT_KEY_SECRET`, and the checked Vercel firewall evidence records the broad all-path outer limit. Deploy the application normally, then complete the Preview/Production environment check in `plan/MANUAL-CHECKS.md` without printing the secret.

If the shared counter is unavailable, protected routes return the documented `503` response instead of silently falling back to an instance-local allowance. A rollback must preserve that fail-closed safety boundary or append another Index presentation change record; the append-only registry must never be edited in place.

## Verification binding

The PostgreSQL golden tests use independent clients against one shared database to prove exact cross-instance enforcement, fixed-window rollover, bounded counters, and deterministic expired-row cleanup. The API and rate-limit contract tests prove every protected route retains its response schema while declaring the reviewed `429` and `503` behavior.
