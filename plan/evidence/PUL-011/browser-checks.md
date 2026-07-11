# PUL-011 browser checks

Checked `/civica-index/methodology/pulse` in the in-app browser against the
local production implementation.

- Runtime version displays `v2.7`.
- The sidebar contains `Decision ledger` and links to the independent-decision
  section.
- The section names all seven axes: event existence, subject attribution,
  category labels, severity, calibration, corroboration, and publication.
- The formula labels the value `corroboration_weight`; no stale generic
  confidence formula remains.
- Light and dark modes render without horizontal overflow.
- The browser console contains no errors or warnings.
- A desktop visual inspection confirmed that the sidebar, warning banner,
  heading hierarchy, and section spacing remain consistent with the reader
  design system.

The raw API URL was not used as a browser check because the browser client
blocked the navigation. API shape and runtime content are covered by the
contract tests and `validate:pulse-runtime` instead.
