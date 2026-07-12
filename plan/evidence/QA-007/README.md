# QA-007 — Deterministic golden tests for every published calculation

**Task:** Add deterministic golden tests for every published calculation and
example. Done when normalization, reconciliation, conditions, taxonomy/peer
lenses, all Index candidates, uncertainty/sensitivity, Pulse decay/classification
metrics, and methodology worked examples reproduce versioned expected artifacts
from fixtures.

All work is DB-free and deterministic. Every locked value was captured by running
the real production function on a fixed synthetic input, then written into the
test — no value is hand-derived or "plausible".

## Files created / modified

Created:

- `src/lib/qa/golden-tests-registry.ts` — typed, version-tagged (`civica-golden-tests/v1`)
  registry mapping each of the 8 Done-when subtopics to its golden test file(s),
  its source-of-truth production module(s), and the protected Index transform(s)
  it pins. Exposes `goldenTestsRegistryErrors(registry, { fileExists, protectedPaths })`
  (injectable existence probe so the same logic runs in the validator and in a
  seeded-failure unit test).
- `src/lib/qa/golden-tests-registry.test.ts` — positive test (registry passes
  against the real repo) + seeded-failure tests (missing golden file, dropped
  subtopic, unregistered protected transform all detected).
- `scripts/validate-golden-tests.ts` — pure/DB-free validator. Reads the registry,
  asserts schema version, that all 8 subtopics are covered, that every registered
  test file and source-of-truth module exists on disk, and that every declared
  protected transform is registered in the Index change-control net.
- `src/lib/conditions/__tests__/conditions-golden.test.ts` — Conditions identity
  passthrough golden: normalized scores persist verbatim and NO combined/composite
  score is produced.
- `src/lib/ci/tournament-candidates-golden.test.ts` — one fixed development-split
  panel drives baselines B0–B3 and candidates K1–K5; exact composite values (and
  structured-output hashes for K3–K5) are locked.
- `src/lib/pulse/v2/score-golden.test.ts` — exact `decayedImpact` deltas for named
  severity-tier/day-offset combos, the `clampSeverityToTier` classification-severity
  metric, and the end-to-end `calculateDimensionalDeltas` deltaValue.

Not modified (owner applies): `package.json` (add the `validate:golden-tests`
script + build-chain insertion — see below).

## Commands + output

```
$ node --import tsx --test src/lib/qa/golden-tests-registry.test.ts \
    src/lib/conditions/__tests__/conditions-golden.test.ts \
    src/lib/ci/tournament-candidates-golden.test.ts \
    src/lib/pulse/v2/score-golden.test.ts
# tests 24  pass 24  fail 0

$ ./node_modules/.bin/tsx scripts/validate-golden-tests.ts
PASS — 8/8 published-calculation subtopics carry deterministic golden coverage
across 9 test files; every source-of-truth module and protected transform is
registered.

$ npm run validate:ci-uncertainty
PASS — ci-uncertainty/beta-r5 removes generic spreads, random scoring, and
unsupported covariance claims.

# Full proposed validate:golden-tests test set (all registered golden test files):
$ node --import tsx --test <10 registered test files>
# tests 70  pass 70  fail 0
```

Per QA-007 constraints, `npm run build` / `next build` / a full `npm test` /
`tsc --noEmit` were intentionally NOT run (a dev server and the concurrent EXP-036
blog edits would corrupt the Turbopack cache / pick up unrelated edits). Only the
targeted commands above were used.

## 8-subtopic coverage table

| # | Subtopic | Status | Golden test file(s) | Source of truth |
|---|----------|--------|---------------------|-----------------|
| 1 | Normalization | already covered | `src/lib/ci/__tests__/worked-examples.test.ts` (§3) | `src/lib/ci/normalize-v2.ts` |
| 2 | Reconciliation | already covered | `src/lib/factbook/reconcile/__tests__/reconciliation-worked-examples.test.ts` | `src/lib/factbook/reconcile/fact-keys.ts` |
| 3 | Conditions | **newly added** | `src/lib/conditions/__tests__/conditions-golden.test.ts` (+ `ingest-repeatability.test.ts`) | `src/lib/conditions/ingest.ts` |
| 4 | Taxonomy / peer lenses | already covered | `src/lib/peer-grouping/__tests__/atl-017-taxonomy-peer-lens.test.ts`, `vdem-row-tier.test.ts` | `src/lib/peer-grouping/*`, `src/lib/government-taxonomy/index.ts` |
| 5 | All Index candidates (B0–B3, K1–K5) | **newly added** | `src/lib/ci/tournament-candidates-golden.test.ts` | `src/lib/ci/tournament-baselines.ts`, `tournament-candidate-k1..k5.ts` |
| 6 | Uncertainty / sensitivity | already covered | `src/lib/ci/sensitivity-analysis.test.ts` (+ `validate:ci-uncertainty`) | `src/lib/ci/uncertainty-policy.ts`, `monte-carlo.ts`, `sensitivity-analysis.ts` |
| 7 | Pulse decay / classification metrics | **newly added** | `src/lib/pulse/v2/score-golden.test.ts` | `src/lib/pulse/v2/decay.ts`, `taxonomy.ts`, `score.ts`, `ensemble.ts` |
| 8 | Methodology worked examples | already covered | `src/lib/ci/__tests__/worked-examples.test.ts` | `src/lib/ci/calculate-v2.ts`, `normalize-v2.ts` |

The registry (`src/lib/qa/golden-tests-registry.ts`) is the machine-readable form
of this table; `validate:golden-tests` fails closed if any listed file disappears,
any subtopic loses coverage, or a pinned transform leaves the Index change-control net.

## Locked golden values (captured from real production output)

- **Conditions** — identity passthrough: `normalizedScore` 92.9 / 41.5 stored verbatim; no `composite`/`combined`/`overall`/`total`/`aggregate` field emitted.
- **Baselines** (panel ZAC/ZAD/ZAE @ 2005, all development split): B1 = [0.72, 0.31, 0.55]; B2 = [68.833…, 33.666…, 54.666…]; B3 z = [1.83355…, -2.11597…, 0.28241…] with fitted loadings [0.50239, 0.49631, 0.50253, 0.49874].
- **K1** composite integers/ranks: ZAC 69 (r1), ZAE 55 (r2), ZAD 34 (r3); no published range.
- **K2** ZAC placements [100,50,100], spread 50, iqr 25, mean 83.33, midpoint 33.33.
- **K3** observed executive tenureDays 2383; output hash `7092853a…`.
- **K4** coding states [no_tagged_excerpt, candidate_topic_match…, no_tagged_excerpt]; hash `87e2a8b3…`.
- **K5** relation `appoints_or_selects` → cabinet, pending coding; hash `969789af…`.
- **Pulse decay** `decayedImpact`: coup −9×0.8 → −7.2 (day 0), −3.6 (day 365 = 1 half-life); journalist_arrest −5×0.7 → −3.5 (day 0), −1.75 (day 60); fair_election 5×0.9 @ day 45 → 3.181980515339464. Unknown category → 90-day default.
- **Pulse classification** `clampSeverityToTier`: (−12, catastrophic_neg) → −10; (3.6, moderate_pos) → 4; (−9, low_neg) → −2.
- **Pulse score** `calculateDimensionalDeltas` deltaValue: stability −7.2, freedom_rights −1.75, all other dimensions exactly 0.

## Notes / limitations

- No published calculation was found that lacks a stable, DB-free output to golden.
  The qualitative K3/K4/K5 tournament prototypes do not emit a numeric composite by
  design; their goldens lock exact structured output plus a full-output hash.
- Conditions has no composite by design (identity passthrough); the golden asserts
  the absence of a combined score so a future silent composite is caught.
