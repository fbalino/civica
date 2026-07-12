# PLT-026 — true 404 vs infrastructure failure + error boundaries

Completed 2026-07-12.

## The bug fixed
Country pages resolved identity with
`getJurisdictionBySlug(slug).catch(() => null); if (!x) notFound()`. Because the
catch swallowed a **database/query failure** into `null`, a DB outage rendered
a **404 on every country** — and a 404 is cacheable and indexable, so an outage
could de-index real countries. (`layout.tsx` even carried a comment
acknowledging this, but the catch defeated it.)

## Changes
- Removed the error-swallowing `.catch(() => null)` from the identity resolver
  in `country/[slug]/{layout,page,constitution/page}.tsx`. `getJurisdictionBySlug`
  returns `null` only for a genuinely absent slug (→ `notFound()`, branded 404);
  a DB error now **throws** and bubbles to the error boundary (HTTP 500 —
  transient, non-indexable). Legitimate secondary-data catches (legislature,
  bills, sources — graceful section degradation) are unchanged.
  `civica-data/page.tsx` is an Index-change-control-protected file; it is not
  edited here and is backstopped by the shared layout's un-caught resolution
  (documented exception in the guard test).
- Added `src/app/error.tsx` — route-segment boundary: tokenized editorial UI,
  a `reset()` retry, a home link, and `console.error` logging with the render
  digest.
- Added `src/app/global-error.tsx` — root boundary owning its own
  `<html>`/`<body>`, `robots: noindex,nofollow`, token-var styling, retry, and
  logging.

## Verification (2026-07-12)
- `src/app/error-boundary.test.ts` — 2 tests: no identity resolver swallows DB
  errors into a 404 (scans all 98 app `.tsx`, excepts the one protected page),
  and both boundaries exist with `<html>` + `noindex` in global-error.
- Browser: `/country/thiscountrydoesnotexist` → branded "Country Not Found"
  404 (genuine absence still 404s correctly).
- `npm run build` GREEN (compiles both boundaries; 107 static pages);
  design-token, lint, and the full test suite pass.

## Note
The 503 framing in the acceptance text is realized as Next's error-boundary 500
status, which is equally transient and non-indexable; the essential fix is that
a DB failure is no longer a 404. Wiring these boundaries into monitoring is
PLT-018's scope.
