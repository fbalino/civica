# ATL-029 — Versioned Conditions public read

## Status

In progress. The Conditions writer now stores immutable release headers,
calculations, components, and reference sets, but the public
`/civica-conditions` explorer still reads the generic `metric_definitions` /
`country_metrics` path. It therefore cannot identify a Conditions release,
show component-level provenance, or report the actual Conditions coverage.
The configured database was checked read-only on 2026-07-18 and does not yet
contain `civica_conditions_releases`; the authored migrations must be applied
to the isolated staging database before a real release/page/API verification.
The existing local Next development process was also observed stuck in a
Turbopack rebuild on 2026-07-18, so the browser screenshot for the new honest
unavailable state remains pending a responsive local or staging server.

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

1. Add a pure, tested public-release model that selects exactly one immutable
   release and derives country/dimension coverage from calculation rows.
2. Make the database query hydrate that model from release, calculation,
   component, source, and score records.
3. Replace the generic-metric Conditions explorer read path and the country
   panel read path with this one selected release, including source/year/
   missingness disclosure.
4. Add a public versioned Conditions API, its route contracts/docs/fixtures,
   and browser fixtures against deterministic Conditions data.
5. After an isolated staging release is approved, verify page/API values
   against the stored release and preserve the evidence before marking ATL-029
   complete.
