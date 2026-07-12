# ATL-009 — implementation completion record

Completed 2026-07-12. This record supersedes the `not_applied` state in
`README.md`/`verification.md`, which froze the pre-implementation audit. The
cross-corpus constitutional full-text search research feature is now applied,
populated, and verified. The audit files are retained as the historical
baseline that defined the gates below.

## What shipped

- **Data boundary.** New immutable relation `constitution_passages`
  (migration `0030_cute_namora.sql`, registered in the authoritative manifest)
  holds one normalized, versioned passage per current section with a stored
  `tsvector` search column, a partial GIN search index, topic and jurisdiction
  indexes, a strict contract `CHECK`, and a DAT-016 history trigger. Search
  reads this relation, never a request-time `ILIKE` over `full_text_html`.
- **Backfill.** `scripts/backfill-constitution-passages.ts` populated
  **96,126 current passages across 186 constitutions**; the corpus validator
  reports `superseded_passages: 0`, `invalid_supersession_rows: 0`, and
  `failures: []`.
- **Query layer.** `src/lib/db/queries-constitution-search.ts` +
  `src/lib/constitution/search-contract.ts` implement indexed
  `websearch_to_tsquery` matching with `ts_rank_cd`, term/phrase semantics,
  jurisdiction and topic filters, deterministic keyset pagination (20/page),
  and escaped highlight segmentation.
- **API.** `/api/constitution/search` returns schema-versioned results with
  per-passage provenance (source, CC-BY-NC-3.0 license, terms URL, retrieval
  time, content hash), jurisdiction status, document nature/date labels, a
  keyset cursor, and a rights block (`bulkExport: blocked`,
  `access: interactive-noncommercial-display-only`).
  `/api/constitution/passages/[hash]` resolves stable passage citations.
- **Reader UI.** `/constitution/search` composes the canonical design system
  (breadcrumbs, serif H1, rounded search field, filter dropdowns, result
  cards, topic chips, highlighted terms, disputed-jurisdiction chip).
- **Cross-cutting contracts.** The relation is registered in the schema data
  dictionary (DAT-009) and the research-evidence retention registry (DAT-016);
  the rights manifest (DAT-003) adds a verified Constitute Project record and a
  `constitution-search-display-v1` product with bulk export blocked.

## Verification performed (2026-07-12)

- `scripts/validate-constitution-search-corpus.ts` (SELECT-only): passes —
  96,126 current passages, all six indexes present, zero structural failures.
  Known honest gaps preserved: 20/186 documents have statement-level
  provenance, 0 source hashes on those, 2 stale statement URLs — surfaced as
  conservative disclosures, never as verified rights.
- `scripts/validate-constitution-search.ts` (prebuild gate): `contract OK`.
- Unit tests (15, no DB): `passage-index` (3), `search-contract` (3),
  `search-backend-contract` (3), `constitution-search-ui` (6) — all pass.
- Benchmark (`scripts/benchmark-constitution-search.ts`): warm DB execution
  **p95 2.5 ms** (gate ≤100 ms); Neon round-trip p95 186 ms (network).
- API edge states (live): valid phrase → ranked results with highlights;
  empty query → HTTP 400; nonsense → `no_results` (not an outage); hostile
  `<script>` markup → escaped `no_results`.
- Browser QA (`/constitution/search`, 1280×900, light): results view and the
  "No passages found" state render on the design system with no console
  errors. Kosovo renders with its limited-recognition chip, matching the
  acceptance fixture.

## Remaining honest caveat

The acceptance contract's warm **API/server** p95 ≤300 ms gate was measured
only against the Turbopack dev server (dominated by dev-compile overhead, not
representative). The controllable DB-execution p95 (2.5 ms) and Neon RTT
(186 ms) both pass; a production-build API-path measurement is queued as a
performance-suite item under EXP-026/QA-014 rather than claimed here.

## Cross-cutting registry propagation (required by the build gates)

Adding `constitution_passages` and extending `src/lib/rights/manifest.ts`
rippled through several hash-pinned registries. Each was propagated (not
suppressed), which is the plan's "update every registered surface" discipline:

- **Schema data dictionary (DAT-009).** Regenerated to 77 tables / 1090
  columns (constitution_passages adds 26 columns). Unit-test literals in
  `src/lib/data-dictionary/build.test.ts` advanced 76→77 and 1064→1090.
- **Research-evidence retention (DAT-016).** `constitution_passages` is in
  `RETAINED_EVIDENCE_RELATIONS` with its BEFORE UPDATE/DELETE trigger in
  migration `0030`; `evidence-retention.test.ts` now reads `0030` and matches
  drizzle's quoted `ON "constitution_passages"` form.
- **Governance-evidence review packet (GOV-014/IDX-028).** Regenerated
  (`reproduce:governance-evidence-review-packet`); 49 artifacts bound, external
  review still pending. The packet reproduces from current code and no reviewer
  has received it.
- **Atlas review packet (GOV-013).** Regenerated (`generate:atlas-review-packet
  --write`) to re-pin the changed schema-dictionary hash; 15 artifacts, 10
  bounded questions.
- **Index change-control (IDX-030).** ATL-009 touched no protected Index file,
  so no methodology append was warranted. `manifest.ts` was cited as
  head *registry-evidence*; per the contract's design the head tracks mutable
  live evidence, so its evidence pin for that one file was refreshed to the
  current hash. Version chain unchanged (v28); validator passes.
- **G2 atlas RC (DAT-022).** Its bundle rights-manifest is regenerated from
  live `buildRightsManifest()` and the validator compares byte-for-byte, so the
  Constitute rights addition required a reproducible repackage
  (`package:g2-atlas`). Only `rights-manifest.v1.json` and `SHA256SUMS` changed
  inside the bundle; the frozen vintage data is untouched. The archive is now
  1,869,727 bytes, SHA-256 `978476a32355767eac6e73e792cd31580f850d9b498d576b4926fa4e10c9e53d`
  (the prior documented `bb845c3d…`/1,869,053 references were already stale from
  an earlier rights-manifest change; DAT-022/024 and PROGRESS now carry the
  accurate value). `validate:g2-atlas` and credential-free `reproduce:g2-atlas`
  (0 network requests) both pass.
