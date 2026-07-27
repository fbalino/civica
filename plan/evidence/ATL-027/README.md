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

The configured database's authoritative ledger remains at `0032`. `0042`,
the new explicit release-ID ingestion commands, and a reference-set inspection
must first run on the disposable staging branch defined by PLT-019. ATL-027
stays unchecked until that evidence and an authorized production promotion
exist.
