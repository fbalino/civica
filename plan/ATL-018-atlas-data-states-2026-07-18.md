# ATL-018 — Atlas data-state contract

**Date:** 2026-07-18
**Status:** implementation and cross-route audit complete; final release gates pending

## Objective

Make an unavailable query visibly different from a successful query with no
rows, without inventing a country-level judgment from either state. The first
implementation pass covers the unified country reader because it previously
used caught empty arrays as section-visibility gates.

## Closed state vocabulary

| State | Reader meaning | Canonical presentation |
| --- | --- | --- |
| Loading | A client-side interaction is still requesting a result. | Existing component loading affordance; server routes wait for the response. |
| Empty | A successful query found no applicable records. | `Banner` or `.editorial-empty` explaining that the absence is not a substantive claim. |
| Error | The request could not complete. | `Banner variant="warn"`; preserve the surrounding module and never replace it with an empty result. |
| Partial | Some independent inputs are available. | Render the usable subset and identify the unavailable input. |
| Stale | A source has an older known retrieval date or frozen vintage. | Existing `SourceDot` / freshness presentation. |
| Disputed | The underlying value is contested. | Existing `DataValueState` disputed treatment and source-linked disclosure. |
| No source | A displayed value lacks usable source metadata. | Existing `DataValueState`/provenance disclosure; never fabricate a source date. |

## Implementation boundary

1. A small server-query result helper retains the difference between a
   fulfilled query and a rejected query.
2. The Factbook, Civica Data, and country Constitution tabs consume that helper
   where an outage previously became an empty array, `null`, or a vanished
   section.
3. The Civica Data navigation lists every documented module. Each module then
   says whether it has no applicable records, is temporarily unavailable, or
   can render its available subset.
4. Existing `Banner`, `DataValueState`, and `SourceDot` primitives remain the
   canonical visual language; this task adds no page-local state styling.
5. The home catalog, Atlas map, party browser, rankings, and country comparison
   now distinguish a rejected dependency from a healthy zero-result response.
   In comparison, independent sections stay visible and a named register
   identifies any unavailable input.

## Verification target

- Unit tests prove the query helper cannot manufacture an empty result from a
  rejection and that the country reader preserves all documented sections.
- The Atlas surface matrix records the new states and named test posture.
- A Playwright fixture exercises the state register at desktop and narrow
  mobile widths in light and dark themes, and inspects a real country reader
  page for the full visible module register.
- Static contracts cover the country reader, map, and comparison route so a
  later refactor cannot turn a query rejection back into an implied absence.
