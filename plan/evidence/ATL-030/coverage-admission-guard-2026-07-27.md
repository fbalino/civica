# Conditions production coverage-admission guard

Date: 2026-07-27

Scope: local implementation and deterministic fixtures only. This record does
not claim a new staging run, production migration, production Conditions
release, provider approval, or owner sign-off.

The World Bank economic capture previously rejected only total absence. A
single observed jurisdiction could therefore allow a global release containing
explicit missing rows for almost the entire expected country spine. The
production workflow now requires at least 75% coverage for each of inflation,
unemployment, and real GDP growth, and independently requires at least 75% of
admission-eligible jurisdictions to have all three components aligned to one
reference year.

Admission eligibility is the explicit `sovereign_state` subset used by the
public Conditions calculation and component reads. In the current captured
input, that means the guard denominator is 194 sovereign-state rows, while the
capture, calculations, components, and release ledger retain all 239 ISO-coded
jurisdiction rows. Non-sovereign observations and missingness therefore cannot
help or harm admission. The floor is deliberately above a simple majority
while allowing genuine publisher noncoverage to remain visible as explicit
missing data. A later methodological change must change the named contract
constant and its boundary fixtures together.

The dedicated Conditions suite proves:

- one observed jurisdiction cannot pass;
- zero coverage still fails with its explicit diagnostic;
- component coverage below the floor fails;
- aligned all-component coverage below the floor fails;
- coverage exactly at the floor passes; and
- the admission predicate matches both public Conditions query filters;
- mixed sovereign/non-sovereign rows prove excluded observations neither help
  nor harm the guard while remaining in the returned ledger; and
- missing-country rows remain explicit after the release meets the floor.

Verification:

```sh
npm run validate:conditions-components
```

Result: 51 tests passed, including the coverage-boundary, public-eligibility,
and mixed-universe fixtures, followed by both Conditions contract validators.
