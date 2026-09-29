# PLT-033 — daily page cache and an idle production database

Owner decision: 2026-09-29, recorded as APR-D177. Public pages are cached
after each day's imports and served from the cache on every visit; they are
not re-rendered per request.

## Findings that motivated the change (2026-09-29)

- The production database (Neon, 0.25 CU, suspends after 5 idle minutes) was
  awake in every hour of the day.
- Every database-backed public page declared `revalidate = 0`, so every
  crawler request rendered from the database. Vercel logs showed 3–60
  uncached page renders per minute; PostHog showed about 5–25 consented
  readers per day.
- The proxy wrote a telemetry row for a 5% sample of all requests, about 11
  database writes per minute at the observed ~220 requests per minute.
- `operations.health-alerts` ran every 15 minutes and wrote its ledger each
  time.

## What is enforced

- `npm run validate:cache-consistency`: 49 database-dependent page surfaces;
  21 declare `revalidate = 86400` and 28 are request-live through the
  14-entry `LIVE_PAGE_ROUTES` allowlist (admin and coding workspaces, the
  admin sign-in page, and 11 public pages that read the query string). New
  seeded fixtures fail on a cached page with another literal, a cached page
  that reads request input, a cached page under a dynamic segment without
  `generateStaticParams`, a stale or undeclared allowlist entry, and an
  allowlisted layout wrapping a page outside its subtree.
- `npm run validate:route-performance-telemetry`: the proxy matcher is exactly
  `["/api/:path*"]` and requests are recorded only for request-live handlers.
- `npm run validate:health-status`: the monitor schedule is `15 10 * * *`.
- `npm run validate:cron-safety`: `operations.refresh-pages` is registered,
  wrapped, and inside the lease margin; its warm-up fixtures run in the suite.

## Local verification (2026-09-29)

- Full `npm run build` passed. Page routes in the build output: `/`,
  `/_not-found`, `/about`, `/about/advisory-board`, `/api-docs`,
  `/civica-index/methodology`, `/civica-index/methodology/pulse`,
  `/civica-index/methodology/pulse/backtest`, `/country`,
  `/country/methodology/reconciliation`, `/elections`, `/elections/systems`,
  `/leaders`, `/methodology/approach`, `/parties`, `/rankings`, and
  `/sitemap.xml` are `○` with a 1-day revalidate; `/country/[slug]`,
  `/country/[slug]/civica-data`, `/country/[slug]/constitution`, and
  `/organizations/[slug]` are `●` and render on first visit.
- A credential-free `next build` (empty `DATABASE_URL`, as in CI) also
  passed; pages that read the database render their existing unavailable
  states.
- `next start`: `/` and `/rankings` returned `x-nextjs-cache: HIT`;
  `/country/france/civica-data` returned `MISS` then `HIT`, both with
  `s-maxage=86400`; `/compare` stayed `private, no-store`.
- `?section=bills` and `?section=organizations` on the Civica Data tab
  scrolled to the named section, matching production; a plain load stayed at
  the top.
- The 2026-09-29 production sitemap has 849 URLs; 829 are warm targets
  (760 country pages). Production pages rendered in about 2–3 seconds each
  (11 seconds for `/elections`), so a refresh run is estimated at seven to
  nine minutes.

## Still open (task remains unchecked)

- After deployment, observe the Neon compute graph for at least one full day
  and record whether the database suspends outside the scheduled windows
  (01:00–06:30 imports, 08:00–09:00 Pulse, 10:00–10:20 refresh and health,
  the 6-hourly Pulse review check, and 23:50–23:55 monitors).
- Confirm on the first production run that `operations.refresh-pages`
  completes inside its budget and that `x-vercel-cache` reports `HIT` for a
  country page after it.
