# PUL-012 browser checks

Checked `/civica-index/methodology/pulse` against the local application after
the production build and live additive migration.

- The page identifies runtime method `pulse-v2.8-beta`.
- The Jurisdiction roles section renders and explains primary, affected,
  versioned catalog/alias identity, fail-closed resolution, legacy projections,
  and the validation boundary.
- Desktop light and dark modes retain the reader hierarchy, warning banner,
  navigation, and sidebar treatment.
- A 390 × 844 responsive check has no horizontal overflow; document and client
  widths both resolve to 379 CSS pixels.
- Desktop document and client widths both resolve to 1269 CSS pixels.
- Browser console inspection returned no warnings or errors.

The in-app browser blocked direct navigation to the raw JSON endpoint. The
event response was instead strict-schema validated through the live query and
the API contract suite.
