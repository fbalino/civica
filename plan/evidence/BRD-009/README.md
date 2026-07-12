# BRD-009 — non-commercial-source monetization gate

Completed 2026-07-12.

- `src/lib/rights/monetization-gate.ts` derives the non-commercial-only source
  set directly from the rights manifest (`commercialUse === false` or
  `publicExport === "non-commercial-only"`). Current set (5): `ipu_parline`,
  `constitute_project`, `international_idea` (the spec-named restricted sources)
  plus `global_peace_index` and `bjornskov_rode`.
- `monetizationGateErrors()` fails when `CIVICA_COMMERCIAL_DEPLOYMENT=true` or
  `CIVICA_FEE_BEARING_ACCESS=true` while any non-commercial source is active —
  blocking a paid subscription/API/embed/commercial release until those sources
  are relicensed or removed (with owner/legal approval).
- `npm run validate:monetization-gate` is wired into `npm run build` after
  `validate:rights-manifest`.

## Verification
- Live at the current (non-commercial) posture: PASS, listing the 5 restricted
  sources.
- With `CIVICA_COMMERCIAL_DEPLOYMENT=true`: **FAIL (exit 1)** naming each
  blocking source.
- `monetization-gate.test.ts` — 5 tests: the real manifest lists the NC sources;
  default posture passes; commercial + NC fails; fee-bearing + NC fails;
  commercial with no NC sources passes (the post-relicensing path). Lint clean.

## Note
This gate is mechanical. Actually charging money still requires the owner/legal
relicensing decision (BRD-003/008) — the gate makes shipping a paid product
impossible until that happens.
