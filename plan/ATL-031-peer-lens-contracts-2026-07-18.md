# ATL-031 — Peer-lens contracts

## Purpose

Make every comparative peer cohort declare the measure domain, derive its
universe from observed values for that measure, and preserve both the
classification vintage and the fallback decision.

## Contract

- Governance measures use only the V-Dem governance lens.
- Material/Conditions measures use only the World Bank region-and-income
  material lens.
- A peer resolver receives an explicit, metric-observed sovereign universe;
  it never expands that universe to every stored jurisdiction.
- Results retain the attempted cohort size, final cohort size, eligible
  universe size, fallback chain, and upstream classification vintage.
- The material outcome graph and its existing strip-data API expose this
  metadata for a selected country. The legacy Index panel removes the invalid
  material comparison and passes its released observed-score universe to the
  governance resolver.

## Verification

1. Extend pure peer-lens fixtures for domain routing, observed-universe
   scoping, fallbacks, attempted/final counts, and source vintage.
2. Exercise request-contract parsing for the country-scoped API metadata.
3. Run the targeted tests, typecheck, token validation for the panel update,
   scoped lint, and the master-plan validator.
4. Run a local browser check if the development server and database can render
   the Factbook outcomes module without altering user-owned work.

## Completion evidence

The evidence record will list the exact commands, results, source files, and
any environment-limited browser check.
