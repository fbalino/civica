# DAT-032 evidence — complete reconciliation candidate vintages

## Release contract

Methodology v0.3-beta freezes every normalized resolver input before publishing winners. Each candidate carries its complete resolver payload, source and status, upstream payload hash when retained or a typed normalized-observation hash, adapter hash, resolver hash, and content hash. The release manifest records candidate and winner counts plus deterministic checksums. Winner rows point to immutable candidate IDs under the same label.

Publication is resumable but fail-closed. Candidate and winner chunks remain behind a `staging` release. A database trigger verifies actual candidate counts, winner flags, linked winner pointers, and manifest counts before allowing the sole transition to `complete_candidates`. Public selectors accept only complete or explicitly legacy releases.

## Live Q2 proof

- Label: `Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2`.
- Actual cut: `2026-07-11T06:41:29.000Z` (manual post-quarter cut; the regular T+15 cron remains scheduled for future quarters).
- Candidates: 25,827; winners: 17,515.
- Candidate checksum: `6dfd021d56393bf72d3e8a515d2958c4e1b0723de605bbef1480fcea5fe31f2b`.
- Winner checksum: `3d380dde76aa37f8db41a27a5c7da0a0febc06d97917cdc01d9fbde996f039a3`.
- Resolver hash: `248ce8b7ff6b5c491269c19ed6b259bbbb346c775e6fbc45d96b34bd2a258e29`.
- Exact writer rerun reported `unchanged: true`.
- A completed-candidate UPDATE probe was rejected by the database trigger.
- Every winner has a same-release candidate pointer flagged canonical.

## Offline proof

`npm run replay:reconciliation-release -- --export=/tmp/civica-q2-reconciliation-replay.json.gz` produced a 4.9 MB local package. Replaying it with `--input` reproduced both checksums and reported `networkRequests: 0`. The package is evidence-only and is not committed because candidate payload redistribution remains source-rights dependent.

## Historical boundary

The Q1 cut remains immutable for canonical value citation but is registered and exposed as `canonical_only_legacy`. The live audit found 7,963 current candidate identities with post-cut retrieval state, 4,219 selected identities now carrying post-cut retrieval state, and 171 changed selected contents. Those facts rule out an honest retrospective candidate-set reconstruction.

## Verification

- `npm run validate:candidate-vintages` and `:live` — pass.
- `npm run validate:authoritative-migrations:live` — 7/7, fingerprint `22ea9db0d3ca41998e305b04ae364465c09b2ab596f39d08a55954431ed1e03c`.
- `npm run validate:claims-docs` — pass, including 651/651 tests.
- `npm run build` — pass.
- Local Q1/Q2 API checks exposed legacy/complete status and checksums correctly.
- The rendered reconciliation page showed v0.3-beta, the Q1 limitation, and Q2 boundary with no console errors.
