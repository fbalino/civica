# PLT-014 route response cache audit — 2026-07-14

## Scope

Audited every repository-owned App Router method registered in
`ROUTE_INVENTORY`: 100 route files and 159 method tuples. The comparison used
each tuple's `ROUTE_FRESHNESS_POLICY` profile and inspected response producers
reachable from the exported handler through local helper calls, canonical
response helpers, and final-response boundaries.

The audit did not inspect or change the owner's country-photo trials,
typography tester, country layout, `FactbookHeaderStrip`, `DESIGN.md`, root
layout, or licensing page.

## Confirmed findings

### P1 — The previous gate declared policies but did not prove responses

`scripts/validate-cache-consistency.ts` previously proved that every route
method had one profile and rejected cacheable header literals written directly
in a request-live route. It did not require a successful response to emit that
profile, did not inspect individual reachable response constructors, and did
not understand imported response boundaries. A bare successful
`NextResponse.json(...)` therefore passed if the route had no `Cache-Control`
at all. The country scores success response was the sealed regression example.

Fix: `inspectHandlerCacheProfile()` now resolves exported function handlers,
local helper calls, cron handler-factory aliases, canonical response helpers,
and returned final-response boundaries. It rejects missing headers,
contradictory profiles, unverified handlers, wrong boundary profiles, and a
boundary that is merely called but not returned. The gate runs this proof for
all 159 registered methods.

Negative fixtures cover:

- a bare successful response beside an unrelated correctly cached error;
- a correct cache call hidden in a dead helper while the live helper is bare;
- a public boundary on a private-live method;
- an unused boundary call that does not seal the returned response.

### P1 — Concrete request-live success paths could omit `Cache-Control`

Confirmed bare public-live success paths were present in:

- `api/countries/[slug]/bills/route.ts#GET`;
- `api/countries/[slug]/constitution/route.ts#GET`;
- `api/countries/[slug]/democracy/route.ts#GET`;
- `api/countries/[slug]/international/route.ts#GET`;
- `api/countries/[slug]/leaders/route.ts#GET`;
- `api/countries/[slug]/structure/route.ts#GET`;
- `api/governance-evidence/[slug]/route.ts#GET`;
- `api/metrics/[metricId]/strip-data/route.ts#GET`.

The shared `withSafeJsonErrors()` boundary only normalized error responses, so
the latter seven successful responses escaped unchanged. It now seals every
returned response to `public-live`; the bills method now returns through the
same final boundary.

### P1 — Private-live methods did not have one final private boundary

`api/contact/route.ts#OPTIONS` returned no cache header. Eleven private/PII
methods used the public safe-error boundary, which did not seal successful
responses and could not guarantee `private, no-store`:

- admin advisory-applications list, admin contact list, Google start/callback,
  and admin-session POST;
- advisory application, contact, and correction submissions;
- Pulse coding session, assignment, and adjudication mutations.

Admin mutation success redirects/JSON across six mutation routes were also
returned unchanged by `withAdminMutation()`. Admin logout, chat early exits,
Pulse coding export, and Pulse coding sign-out similarly lacked one exact final
private profile across all branches.

Fix: the new `responseWithCacheProfile()` /
`withResponseCacheProfile()` runtime boundary overwrites missing or
contradictory cache headers while preserving the original response object,
body, status, redirects, cookies, CORS, and content metadata. Private safe JSON,
admin mutation/logout, chat, and Pulse coding boundaries now use
`private-live`. Contact OPTIONS declares the same canonical profile directly.

### Proof hardening — safe but previously opaque constructions

Constitution search and the retired embed already assembled `no-store` through
local header helpers. They are now returned through the canonical public-live
boundary so the proof does not rely on ad hoc data-flow inference. Existing
checked-build and immutable-release routes retain their dedicated exact
profiles.

## Verification

- `npm run validate:cache-consistency` — PASS; 159/159 methods, 5/5 export
  modules, 76 DB query functions, and 68 page surfaces.
- `npm run validate:route-io-policy` — PASS; 180 focused tests.
- `npm run validate:route-inventory` — PASS; 100/100 route files and 159
  methods.
- `npm run typecheck` — PASS.
- Focused ESLint — PASS.
- Response-cache, safe-error, admin mutation, and admin logout runtime tests —
  22/22 PASS.
- `git diff --check` — PASS.
