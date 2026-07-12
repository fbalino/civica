# Atlas surface and data matrix v1

**Version:** `civica-atlas-surface-data-matrix/v1`

**Audited:** 2026-07-12

**Machine-readable artifact:** `data/atlas-surface-data-matrix.v1.json`

**Semantic SHA-256:** `5e1ddbcaf8840adf7704e52b5a3c9e1560645cf3b21bfeef7599495ecddb4550`

## Scope

The matrix inventories public, data-bearing Atlas routes and every module in
the unified country reader. Each row names the renderer, query or loader,
tables and fields, provenance path, coverage rule, loading/empty/error/partial/
stale/disputed/no-source behavior, existing tests or a named test gap, owner,
and relation to the frozen Atlas export.

The current artifact contains 38 rows:

- 14 top-level data routes;
- the shared country masthead;
- 13 Factbook sections;
- the Factbook source and citation module;
- eight Civica Data modules;
- the country constitution reader.

Static policy, methodology, marketing, account, coding, and admin pages are not
data-bearing Atlas surfaces and are outside this matrix. The provenance- and
source-coverage reports are included because they describe the released Atlas
dataset and its operational domains.

## Release interpretation

Route presence does not imply bulk-redistribution permission. Every row uses
one of five release relations:

- `included_reference_rows`: jurisdiction or permitted frozen canonical-fact
  rows are within `civica-atlas-export/v3`;
- `mixed_row_level_rights`: the route combines exportable canonical facts with
  data or presentation that stays outside the package;
- `excluded_surface_only`: the UI or its underlying table is not part of the
  current normalized export;
- `excluded_restricted_source`: source terms block inclusion in the public
  bulk package;
- `excluded_experimental`: the data belongs to a secondary research product.

The export remains limited to frozen jurisdiction records, permitted canonical
fact observations, and their source-rights rows. It excludes Index, Pulse,
alternate observations, restricted sources, images, constitution text, and
publisher payloads.

## Findings handed to later tasks

The matrix records current behavior; it does not relabel a weak state as
acceptable. Four gaps require later repair:

1. The shared country layout converts both an unknown slug and a database
   outage into `notFound()`.
2. `getFactbookSections` is not soft-failed, so a section-table outage can take
   down the Factbook tab.
3. Most Civica Data modules turn query errors into empty arrays and disappear,
   making “not available” indistinguishable from “temporarily unavailable.”
   The longitudinal-history module now implements the target explicit-state
   behavior; ATL-018 still owns the shared repair for the remaining modules.
4. The country constitution tab uses one empty card for a genuinely unindexed
   constitution and a database failure.

ATL-018 owns the common state contract and representative browser fixtures.
Rows with `testGap` name missing route-level coverage for the country index,
Party Explorer, Conditions, organization detail, and several country modules.

## Maintenance rule

`npm run validate:atlas-surface-data-matrix` fails when a renderer, query,
test, Factbook section, or Civica Data section disappears without a matrix
change. New public Atlas routes and country modules must add a row before they
ship. Any change to frozen-release inclusion must also pass the rights and
Atlas-export validators.
