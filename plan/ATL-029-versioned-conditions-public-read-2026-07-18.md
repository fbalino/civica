# ATL-029 — Versioned Conditions public read

## Status

Complete. The public `/civica-conditions` explorer and every country
`/civica-data` tab now read the same selected Conditions release model, rather
than the generic `metric_definitions` / `country_metrics` path. They disclose
component-level provenance, years, missingness, alignment, and coverage
derived only from that release's calculation rows. A missing release is a
visible availability state, not a silently omitted surface.

The isolated QA-018 database now contains the exact selected release, and its
stored rows, sovereign-state public API projection, explorer, country panel,
and comparison surface have been reconciled. Static verification remains
covered by `npm run typecheck`, `npm run validate:design-tokens`,
`npm run validate:conditions-components`, and
`npm run validate:claims-docs`.

## Adopted public-read contract

Every Conditions reader resolves one `civica_conditions_releases` row before
it reads any calculation. The selected release ID, methodology version, and
manifest hash travel with every API/page response. The public row grain is one
country and Conditions dimension, with its alignment outcome and every
declared native component. A missing or refused component remains visible; it
is never converted to zero or silently omitted.

Coverage is calculated from those returned calculation rows, partitioned by
dimension and alignment outcome. No general sovereign-state denominator is
used, and no Conditions copy may claim a universal `195 countries` coverage.
Economic Stability remains a source-native component ledger with no score
until ATL-028's frozen longitudinal study supplies a valid resolution.

## Work sequence

1. **Complete:** add a pure, tested public-release model that selects exactly
   one immutable release and derives country/dimension coverage from
   calculation rows.
2. **Complete:** make the database query hydrate that model from release,
   calculation, component, source, and score records.
3. **Complete:** replace the generic-metric Conditions explorer read path and
   the country panel read path with this one selected release, including
   source/year/missingness disclosure.
4. **Complete:** `/api/v1/conditions` selects one stored release with
   the same public model as the explorer and country panel. Its closed query
   contract, response schema, registry, rate-limit/inventory policies, API
   documentation, illustrative fixture, and negative schema fixtures are
   checked by `npm run validate:api-docs` and
   `npm run validate:route-io-policy`.
5. **Complete:** `plan/evidence/ATL-029/release-reconciliation.v1.json`
   reconciles the stored all-jurisdiction release to the public
   `sovereign_state` projection and all three reader surfaces. Browser evidence
   is retained under `plan/evidence/ATL-016/`.

Production migration/publication remains separately authority-gated under
ATL-026 and ATL-027.
