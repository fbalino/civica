# PUL-034 verification

Verified on 2026-07-12.

## Live state and migration safety

- The zero-write preflight recorded zero rows in `pulse_daily_scores` and zero
  rows in `pulse_changelog`.
- A clean PostgreSQL 18 fixture dropped both relations. A second fixture with
  one seeded scalar row raised the expected exception and retained the table
  and row. The complete 27-file authoritative SQL path applied on a clean
  PostgreSQL 18 database.
- Production records 27 of 27 authoritative migrations, exposes 71 public
  tables, and matches schema fingerprint
  `830db9e3a2af51bfe226771a1871df0601328e1c40cbe0d9a725e316abec7e91`.
- Both retired output relations are absent in production. The separate
  `pulse_events` table retains all 462 legacy event rows.
- The generated data dictionary covers 71 tables and 974 columns with schema
  hash `70a693e37376828ab55996e7bef8582b254ff111fdaf90a1f26fb4a0aaf650bf`.

## Contract and repository checks

- Six focused tests cover CP casing, unknown sorts, scalar response shape,
  embed cache prevention, cron authorization, GET/POST equality, and stable v2
  successors.
- `npm run validate:pulse-v1-retirement:live` passed with both relations absent
  and 462 legacy event rows retained.
- `npm run validate:authoritative-migrations -- --live` passed at 27/27.
- `npm run validate:claims-docs` passed all seven categories and 904 tests.
- Index change control advanced append-only to
  `civica-index-pulse-scalar-retirement-v18`, binding 97 protected files and
  six declared validations.
- The regenerated Atlas review packet passes with semantic hash
  `f13d1fc70fd20e9101a890211a6d11aee8bbce7f4eb9abea830fdec96ff00b4e`.
- TypeScript, API-doc, Pulse-runtime, data-dictionary, migration, design-token,
  diff-integrity, and full production-build gates passed. The design-token gate
  reports no new drift and retains the 209-item legacy baseline.

## API and browser checks

- Local `sort=CP` returned `410`, code `pulse_scalar_retired`,
  `scalarPulseScore: false`, CORS, deprecation/sunset/successor headers, and
  browser/CDN/Vercel no-store headers. An unknown sort returned the distinct
  documented `400` response.
- The legacy Japan embed with `include=cp` returned an uncached `410` notice
  and no score, rank, or dimension value.
- `/api-docs#widget-embed` rendered the retirement and dimensional successor at
  1440×1000 in light and dark modes with no visible overflow or design-system
  drift. A headless browser confirmed status 200, the expected heading and
  links, and zero console or page errors.
