# Atlas surface and data matrix v1

**Version:** `civica-atlas-surface-data-matrix/v1`

**Audited:** 2026-07-18

**Machine-readable artifact:** `data/atlas-surface-data-matrix.v1.json`

**Semantic SHA-256:** `371bb640b254971b4ca9159e66f5300cba5f56141e2987a516be63a5282793f6`

## Scope

The matrix inventories public, data-bearing Atlas routes and every module in
the unified country reader. Each row names the renderer, query or loader,
tables and fields, provenance path, coverage rule, loading/empty/error/partial/
stale/disputed/no-source behavior, existing tests or a named test gap, owner,
and relation to the frozen Atlas export.

The current artifact contains 40 rows:

- 14 top-level data routes;
- the shared country masthead;
- 13 Factbook sections;
- the Factbook source and citation module;
- ten Civica Data modules (including Conditions);
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

## State hardening

ATL-018 adds the common query-outcome contract and closes the identified
reader-state gaps:

1. The Factbook tab keeps every documented CIA section in the reader and shows
   a named coverage state for a successful empty section or a named temporary
   outage for the section-table query.
2. Every Civica Data section, including Conditions, stays in the sidebar and
   distinguishes fulfilled empty data from an unavailable independent query.
3. The country Constitution tab distinguishes an unindexed document from a
   database outage.
4. The home catalog, Party Explorer, and Rankings table distinguish a rejected
   query from a fulfilled empty result.

The seven-state register is browser-tested at representative desktop/mobile and
light/dark fixtures. Identity-resolution error classification remains governed
by PLT-026 rather than this module-state contract. Rows with `testGap` still
name route-level coverage that has not yet been added outside this scope.

## Source-native map layers

ATL-015 limits the `/atlas` choropleth to the retained V-Dem Regimes of the
World and World Bank income-group variables. The route row records publisher,
upstream vintage, legend, availability semantics, and the shared resolver used
by map hover and the keyboard-accessible table alternative. Civica Index,
Pulse, and the former Civica government classifier are not map layers.

## Maintenance rule

`npm run validate:atlas-surface-data-matrix` fails when a renderer, query,
test, Factbook section, or Civica Data section disappears without a matrix
change. New public Atlas routes and country modules must add a row before they
ship. Any change to frozen-release inclusion must also pass the rights and
Atlas-export validators.
