# ATL-029 — Versioned Conditions public-read evidence

Status: agent-executable implementation and local contracts complete; stored
release/page/API reconciliation pending isolated staging authority.

The explorer, country panel, comparison surface, and `/api/v1/conditions`
select one immutable Conditions release. Every row exposes component years,
sources, missing/refused state, alignment outcome, release ID, method version,
and manifest hash. Coverage is derived from returned calculation rows rather
than a universal sovereign-state denominator. Economic rows expose source
components only and never a stability score.

Verified on 2026-07-23:

- Conditions contract: 19/19 tests passed;
- API docs: all 20 registered v1 routes passed coverage, parameter, example,
  deprecation, rate-limit, and CSV checks;
- route I/O: 108 files, 172 method contracts, 54 request contracts, 22
  operational error boundaries, and 187 focused tests passed; and
- design tokens: zero drift.

ATL-029 stays open until the isolated QA-018 environment contains the new
schema and a captured immutable release, then browser/API output is reconciled
against its stored calculations/export. No provider or database action is
claimed.
