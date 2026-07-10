# DAT-001 evidence — production adapters in the release commit

Status: implementation complete on 2026-07-10.

## Outcome

All 35 deployment-scheduled routes and ten manual Atlas, Index, and Conditions
adapter families now resolve to files owned by the release commit. A DB-,
network-, and clock-free validator closes those entrypoints and fails when a
registered file is absent from the working tree or requested Git ref.

The current `2024-Q4` Civica Index Beta is reproducible from four publisher
artifacts through one canonical pure-parser module. The read-only audit matches
the deployed database exactly across five source/dimension groups:

- V-Dem Democratic Quality: 170 rows
- World Bank WGI Voice & Accountability fallback: 20 rows
- World Bank WGI Rule of Law: 190 rows
- Freedom House Freedom and Rights: 190 rows
- Transparency International CPI: 175 rows

All publisher-file SHA-256 hashes match the frozen release manifest. Every
group has the exact expected row count, no parsed-only or live-only country,
no value difference above `1e-6`, and an identical deterministic six-decimal
semantic SHA-256 checksum.

## Important methodological finding

The deployed democracy dimension was not V-Dem-only: 20 jurisdictions without
a released V-Dem row were filled from WGI Voice & Accountability by code that
existed only on an old branch. DAT-001 reimplements that path on the release
branch, preserves `worldbank_wgi` source identity, and discloses it publicly as
a construct substitution rather than an equivalent measure. This is faithful
reproduction, not endorsement. The later Index tournament decides whether the
fallback, or the Index design itself, adds value.

The current jurisdiction table contains several entities that were not in the
original ingestion universe. The checked-in release manifest names those
eligible-but-not-released ISO3 exclusions, so reconstruction reproduces the
frozen release instead of silently expanding it.

## Implementation contract

- `src/lib/ci/production-source-adapters.ts` — canonical pure V-Dem, WGI,
  Freedom House, and CPI parsers
- `src/lib/ci/production-release-coverage.generated.json` — publisher input
  hashes, frozen release exclusions, row counts, and semantic checksums
- `scripts/audit-ci-production-adapters.ts` — read-only publisher-file to live
  release comparison
- `src/lib/data/production-adapter-registry.ts` and
  `scripts/validate-production-adapters.ts` — scheduled/manual release closure
- `src/lib/ci/__tests__/production-source-adapters.test.ts` — eight focused
  parser, source-identity, manifest, and disclosure fixtures
- `scripts/sync-transparency-cpi.ts` — publisher-workbook CPI metric sync,
  replacing a hand-entered prototype
- `scripts/derive-country-metric-hdi.ts` — deterministic projection of the
  canonical UNDP fact into the legacy metric table still read by product paths

## Verification

- production adapter closure: 35 scheduled routes, 10 manual families, 65
  implementation files; passed in the working tree and against committed HEAD
- focused adapter suite: 9/9 passed
- live clean-room reproduction: all four input hashes and all five semantic
  groups passed; see `ci-reproduction-result.json`
- freshness validator: 667 files passed; no new direct freshness writes
- claims/documentation aggregate: 365/365 tests and all 13 children passed
- TypeScript, targeted ESLint, full production build, and route generation:
  passed
- methodology browser QA: desktop and 390px mobile passed without overflow;
  see `browser-checks.md`

## Clean-room run

A detached worktree was created from commit `740e9ed` with no repository
`node_modules` or local untracked files. `npm ci` installed 631 packages from
the lockfile. In that isolated checkout, release-ref closure (65 files),
TypeScript, all 9 focused fixtures, and the live read-only reconstruction audit
passed. The audit received the existing database credential through the
process environment; no `.env.local`, publisher file, cache, or private-branch
code was copied into the checkout.

## Worker routing and adjudication

One bounded read-only inventory was assigned to `SP53 DAT-001 inventory` using
`gpt-5.3-codex-spark`; its raw result is `sp53-inventory.json`. The worker's
filename-level conclusion that all four Index adapters already existed on
`main` was rejected by primary review because the live fallback producer and
full publisher-backed metric paths did not. Its scheduled-route inventory was
retained as useful input. Primary Codex performed the substantive audit,
implementation, methodological adjudication, validation, and closure.

The worker consumed 6,689,535 input tokens (6,390,400 cached), 30,467 output
tokens, and 18,833 reasoning tokens. That makes Spark CLI delegation a poor
default for broad repository inventories despite its speed.

## Scope boundary

DAT-001 closes code ownership and exact reconstruction of the currently
released inputs. DAT-002 owns the complete versioned source-input manifest;
DAT-003 owns field/product/release rights; DAT-012 owns fixture/dry-run behavior
for every adapter; DAT-019 owns the legally shareable full release clean room;
and G3 owns comparative validation or redesign of the Index.
