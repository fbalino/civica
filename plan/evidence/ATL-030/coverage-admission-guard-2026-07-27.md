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
expected jurisdictions to have all three components aligned to one reference
year.

The ratio is calculated against the current ISO-coded candidate spine rather
than a hard-coded country count. The floor is deliberately above a simple
majority while allowing genuine publisher noncoverage to remain visible as
explicit missing data. A later methodological change must change the named
contract constant and its boundary fixtures together.

The dedicated Conditions suite proves:

- one observed jurisdiction cannot pass;
- zero coverage still fails with its explicit diagnostic;
- component coverage below the floor fails;
- aligned all-component coverage below the floor fails;
- coverage exactly at the floor passes; and
- missing-country rows remain explicit after the release meets the floor.

Verification:

```sh
npm run validate:conditions-components
```

Result: 49 tests passed, including the three new coverage-boundary fixtures,
followed by both Conditions contract validators.
