# ATL-027 — Conditions release freezing

This evidence records the checked implementation of immutable Conditions
release headers, per-period reference sets, and normalization parameters. It
does not claim that the configured Neon database has the new schema or that a
Conditions release has been created there.

## Contract

Every Conditions ingestion now requires an explicit stable release ID. The
release manifest binds its calculation identities, exact sorted reference
population, included components, missingness counts/policy, directions, and
normalization parameters. An identical rerun is a no-op; changed inputs require
a successor release ID. Economic z-score parameters are grouped by reference
year, never pooled across years.

## Checked evidence

- `migration-plan.md` records the local authoritative-chain fingerprint and
  the required staging proof.
- `release-note.md` states the immutable release and recovery boundary.
- `npm run validate:conditions-components` proves release manifests,
  migration application, no-op reruns, and changed-rerun refusal.

## Production completion — 2026-07-29

Production release `conditions-production-20260729-v1` passed full guarded
live validation at authoritative migration head `0051_eminent_jocasta`. Its
stored manifest and exact replay have the same SHA-256; the external
expectations artifact matched the stored manifest and all 340 calculation
counts. The release contains three frozen reference sets and five
normalization-parameter rows, while the immutable replay matched all 340
calculation keys without changing retained tables or writing mutation history.

The immediate-post-release source-freshness gate also passed: all three
release sources were synced exactly at the release creation time. The public
API and browser evidence identify this exact release and manifest rather than
a mutable current aggregate; their Conditions surfaces expose the frozen
release with its components, years, and unavailable/refused states.

Evidence: [`production-release-expectations-2026-07-29.v1.json`](production-release-expectations-2026-07-29.v1.json),
[`production-release-validation-2026-07-29.v1.json`](production-release-validation-2026-07-29.v1.json),
[`../ATL-026/production-public-api-2026-07-29.v1.json`](../ATL-026/production-public-api-2026-07-29.v1.json),
and [`../ATL-026/production-browser-evidence-2026-07-29.v1.json`](../ATL-026/production-browser-evidence-2026-07-29.v1.json).
