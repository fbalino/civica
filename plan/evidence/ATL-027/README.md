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

## Rollout boundary

The disposable QA-018 attempt-07 branch has now applied the complete
authoritative tail through `0051_eminent_jocasta` and retained immutable
release `conditions-20260727-v1`. The bound expectations artifact, stored and
replayed manifest, three reference sets, five normalization-parameter rows,
identical-input zero-write replay, and changed-manifest refusal all passed.
See
[`attempt-07-release-expectations-2026-07-27.v1.json`](attempt-07-release-expectations-2026-07-27.v1.json),
[`attempt-07-release-validation.v1.json`](attempt-07-release-validation.v1.json),
and
[`../QA-018/attempt-07-conditions-release-2026-07-27.md`](../QA-018/attempt-07-conditions-release-2026-07-27.md).

Production remains separately authority-gated. ATL-027 stays unchecked until
the production ledger and public release pass the same manifest, replay,
freshness, and immutability gates.
