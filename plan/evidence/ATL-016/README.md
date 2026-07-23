# ATL-016 — Separate Conditions comparison evidence

Status: agent-executable implementation and local verification complete;
release-backed browser evidence pending isolated staging authority.

The Conditions comparison reads the same single immutable release model as the
explorer and country panel. It exposes native component, unit, source,
reference year, value/missingness, and alignment state; it creates no
cross-country rank, cross-dimension aggregate, or economic-stability score.
Mixed reference years remain visible and all three public surfaces say that no
composite is published.

Verified on 2026-07-23:

- `npm run validate:conditions-components` — 19/19 focused tests and both
  source validators passed;
- `npm run validate:design-tokens` — zero token drift;
- API and route-I/O contracts passed for the selected-release surface.

ATL-016 stays open until migrations `0040`/`0042` are applied to the isolated
QA-018 staging database, a real immutable Conditions release is captured, and
two-/three-country desktop/mobile browser evidence covers aligned,
mixed-year-refused, and missing-component rows. No migration, ingestion,
release publication, deployment, or production write is claimed.
