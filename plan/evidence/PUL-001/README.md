# PUL-001 evidence

## Outcome

PUL-001 is complete through the clearly subordinated policy path.

- Current policy: `pulse-numeric-publication/api-only-experimental-v1`.
- Current method: `pulse-v2.1-beta`.
- Reader UI: numeric deltas omitted; the event ledger remains visible.
- Public API: named per-dimension experimental heuristics with method, standing, validation state, and `scalar_pulse_score: false` metadata.
- Bulk Atlas export: numeric deltas omitted.
- Prose and metadata: API-only status, method version, non-measurement boundary, and incomplete validation are explicit.
- Alternative policy: `pulse-numeric-publication/omit-v1` is executable and snapshot-tested.

Numeric rows remain in the research database. This task changes their public standing, not the scoring algorithm or its stored history.

## Enforcement

`npm run validate:pulse-public-numeric-policy` binds the current policy to the runtime method, reader-route omission, API metadata, bulk-export omission, public prose, and prohibited validation language. `src/lib/pulse/v2/public-numeric-policy.test.ts` freezes both allowed publication policies.

## Verification

The scoped commit is named `research: subordinate Pulse numeric effects`; its hash is available in Git history beside this evidence directory.

```sh
npm run validate:pulse-public-numeric-policy
node --import tsx --test src/lib/pulse/v2/public-numeric-policy.test.ts src/lib/pulse/v2/runtime-method.test.ts
npm run validate:api-docs
npm run validate:claims-docs
npm run validate:design-tokens
npx tsc --noEmit
curl -fsS http://127.0.0.1:3000/api/v1/pulse/brazil/dimensions
node plan/tools/validate-master-plan.mjs
npm run build
```

The live Brazil API response reported `experimental`, `pulse-v2.1-beta`, `public_experimental`, `scalar_pulse_score: false`, and `current_production_backtest_complete: false`. It returned six eligible published events and two non-null dimensional effects; those values were inspected only to prove that the disclosure accompanies real output.

## Browser evidence

See `browser-checks.md` and the four methodology screenshots in this directory. `brazil-desktop-light.png` also records the active country-data route; its DOM contained zero `.pulse-dimensions-panel` elements.

## Remaining limitations

This is a publication-boundary result, not validation of the classifier, retrieval, clustering, attribution, severity, corroboration, calibration, or delta formula. Those questions remain assigned to later Pulse tasks. No human or external check is claimed here.
