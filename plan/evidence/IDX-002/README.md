# IDX-002 evidence

Completed 2026-07-11.

The current Index release is `ci-beta-r3-2024-Q4`, published as methodology `beta-r3`. The clean-room command downloads the four exact declared publisher snapshots, rejects changed byte hashes, parses them through the canonical adapters, joins them to the checked 197-row jurisdiction spine, reproduces PostgreSQL `real` storage, calculates from ordered inputs with deterministic per-jurisdiction seeds, and compares every live field.

Exact live result:

- 745 dimension rows; no identity, raw-value, normalized-value, period, method, or storage differences
- 190 composite rows; no score, interval, completeness, rank, partial-status, coverage, period, method, or label differences
- zero unexplained production-only rows
- dimension SHA-256 `d16100ada72a2037a5c311b098eb8bb283ef0d01f1a346efdf74126b1fb65327`
- composite SHA-256 `dfc3b2d53587fa3901a368b32580f648ee54d68ecbaaae7163515972083b2fa3`

`data/releases/ci-beta-r3-2024-Q4/reproduction-manifest.v1.json` is the checked output contract. `predecessor-audit.v1.json` records why the original Beta and Beta-R1 cannot support an exact claim and why Beta-R2 was superseded during the audit. Those rows were not rewritten.

Verification:

- `npm run reproduce:ci-current` — exact live pass
- `npm run validate:ci-current-release` — current release pinned across ten production consumers
- three clean-room unit fixtures cover repeatability, input-order independence, and PostgreSQL numeric round trips
- source-input and raw-retention manifests pass after adapter-version regeneration
- `npm test` — 659/659 passed
- `npm run validate:claims-docs` and `npm run build` — passed
- Browser check at `/civica-index` showed the Beta-R3 vintage, no horizontal overflow at 1280 px, and no console warnings or errors; the local methodology API returned `id: beta-r3` with the research-beta standing envelope
