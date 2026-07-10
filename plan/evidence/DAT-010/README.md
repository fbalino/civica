# DAT-010 — Row-level derivation versions

## Outcome

Six interpretation-bearing tables now store a non-null
`derivation_version_key` and typed `derivation_versions` envelope:

- `ci_dimension_scores` and `ci_composite_scores`
- `pulse_events_v2` and `pulse_dimensional_deltas`
- `country_fact_vintages`
- `government_taxonomies`

The envelope records methodology, algorithm, prompt, taxonomy, source basket,
and normalized source IDs. Each axis is `versioned`, `not_applicable`, or
`legacy_unversioned`. New builders reject legacy markers, blank identifiers,
and versioned source baskets without source IDs. Content hashes make keys stable
for exact filtering and rebuild selection.

## Writer and release enforcement

- Eight production writer files persist both fields. A whole-source scanner
  fails when a new writer for one of the six tables is not registered.
- The production build validates schema columns, every declared writer, the
  forward migration, future export requirements, and all current release
  artifacts.
- Product export policies require derivation versions. The current frozen Index
  metadata artifact carries an explicit version envelope; public bulk data
  exports remain blocked by the rights contract.
- The schema dictionary was regenerated and now documents 570 columns.

## Live migration

`drizzle/migrations/0021_derivation_version_envelopes.sql` ran as one 36-
statement Neon transaction. Every existing row received an explicit
`legacy_unversioned` envelope; no historical algorithm, prompt, taxonomy, or
source-basket version was inferred. See `live-migration-audit.json`.

## Verification

- Focused derivation-version tests: 14/14 pass, including legacy-input
  propagation and zero-delta non-applicability.
- Full test suite: 439/439 pass.
- TypeScript and targeted ESLint: pass.
- Data-dictionary, source-input-manifest, rights, writer/version, claims, and
  full production build gates: pass.
- Browser verification: not applicable; no rendered UI changed.
