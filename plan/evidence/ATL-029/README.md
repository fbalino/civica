# ATL-029 — Versioned Conditions public-read evidence

Status: complete in the isolated QA-018 staging run.

The explorer, country panel, comparison surface, and `/api/v1/conditions`
select one immutable Conditions release. Every row exposes component years,
sources, missing/refused state, alignment outcome, release ID, method version,
and manifest hash. Coverage is derived from returned calculation rows rather
than a universal sovereign-state denominator. Economic rows expose source
components only and never a stability score.

[`release-reconciliation.v1.json`](release-reconciliation.v1.json) binds the
selected public read to `conditions-20260727-v1`,
`conditions-components/v1`, and manifest
`267cf0f2680bc94153a85386e08ce222c6797b2c26a6a9116de4d24573301743`.
The retained release has 340 calculations, 818 components, and 101 scores
across all jurisdiction rows. The public API deliberately applies the closed
`sovereign_state` filter and returns 295 calculations and 683 components; the
45-calculation/135-component difference reconciles exactly to the query
boundary rather than a general-country denominator.

Verification:

- Conditions contract: 51/51 tests passed;
- API docs: all 20 registered v1 routes passed coverage, parameter, example,
  deprecation, rate-limit, and CSV checks;
- route I/O: 108 files, 172 method contracts, 54 request contracts, 22
  operational error boundaries, and 187 focused tests passed; and
- design tokens: zero drift.

The API and the explorer, country panel, and comparison surface expose the same
release and all three alignment states. Afghanistan, Andorra, and Bosnia and
Herzegovina reconcile the aligned, missing-component, and mixed-year-refused
paths; economic rows carry no score, composite, or rank. This closes ATL-029's
staging-verifiable acceptance criteria. Production migration and publication
remain separately authority-gated under ATL-026 and ATL-027.
