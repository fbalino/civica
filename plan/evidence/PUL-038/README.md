# PUL-038 evidence

PUL-038 replaces the legacy mutable press-freedom scalar with immutable,
source-complete context evidence. The design and research boundary are in
`plan/research/pulse-information-environment-context-v1.md`.

## Result

- The official RSF 2026 CSV matches the previously registered SHA-256 and row
  count.
- One release row fixes source, vintage, retrieval, hash, coverage, rights, and
  use status.
- Every supported non-aggregate jurisdiction has one observed-or-missing value
  row. Unknown values remain null with a reason.
- Every current Pulse event has exactly one immutable classification-time pin.
  All 384 existing pins are marked historically unrecoverable because no
  contemporaneous versioned record existed when those events were classified.
- New event inserts receive a pin through a database trigger. Corroboration
  reads the pin; it cannot update it.
- Production weighting and `restricted_information_environment` observability
  remain disabled pending rights and method validation.
- The restricted publisher file is not checked in or publicly redistributed.

## Evidence files

- `migration-plan.md` — zero-write plan and clean-chain rehearsal
- `verification.md` — code, database, test, and browser checks
- `index-change-control-metadata.json` — semantic change-control input
- `data/releases/pulse-information-environment-rsf-2026/source-input-manifest.v1.json`

## Limits

This task establishes provenance and immutability. It does not validate RSF as
a correction for media asymmetry, clear redistribution rights, activate a
country multiplier, or make the restricted-information observability label a
production inference.
