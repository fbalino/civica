# Release note — Caching Option A (CAC-002 … CAC-005)

**Date:** 2026-08-17 · **Plan:** `plan/caching-restoration-scope.md`

The build adds a deploy-frozen serving path for pure-prose and
checked-artifact pages:

- The unreachable `revalidate = 3600` in the country layout is removed
  (CAC-002); its effective value was already 0 via the minimum-across-segments
  rule.
- `jurisdiction-directory/v1` (`src/lib/jurisdictions/directory.generated.json`,
  253 rows) freezes slug, name, ISO-2, capital, and jurisdiction status
  label/type at deploy time. `npm run generate:jurisdiction-directory`
  regenerates it; `npm run validate:jurisdiction-directory` (wired into the
  production build) fails on any drift against the live `jurisdictions`
  table (CAC-003).
- The root-layout header search and footer country list read that artifact
  instead of issuing per-request database queries; the search combobox's
  status prop narrows to the display label (CAC-004).
- 25 page/layout files whose import graphs no longer reach the database drop
  their now-redundant `revalidate = 0` declarations and become prerendered
  static surfaces (CAC-005). The PLT-014 gate reports 75 surfaces,
  49 DB-dependent, 26 build-only, with no edit to the gate itself.

Reader-visible consequence: a newly added or renamed jurisdiction appears in
the site-wide search and footer after the next deployment rather than
immediately. No rendered fact, SourceDot, registered numeric claim, or
citation surface changes.
