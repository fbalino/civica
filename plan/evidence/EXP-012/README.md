# EXP-012 — point-of-display editorial-art disclosure

## Public behavior

- Every engraved `PageHero` visibly renders `Editorial illustration · AI-assisted, non-documentary` linked to `/licensing#imagery`.
- Page-hero background images remain `alt=""` and `aria-hidden="true"`; the adjacent disclosure is the single accessible description of their evidentiary status.
- Country and territory mastheads keep the concise intended-landmark caption, visible `Editorial engraving` label, and exact `AI-assisted illustration` link. The link's accessible name adds `non-documentary editorial art` without lengthening the plate.
- `/licensing#imagery` now covers country, territory, page, and shared art; names art as non-documentary and not source evidence; links `civica-editorial-illustration-manifest/v1`; separates complete asset coverage from missing historical prompt/model/reference/seed metadata; names automated checks, incomplete human review, correction route, and reuse limits.
- The registered public claim and evidence list match the new policy.

## Automated proof

- `npm run validate:editorial-illustrations` checks licensing, PageHero, About, country/territory captions, styling, color contract, grader, complete manifest, and country corpus.
- The disclosure unit suite has 41 passing cases, including seeded missing language, link, accessible-name, and decorative-art failures.
- `npm run validate:design-tokens` passes with no new drift.
- `npm run validate:claims-docs` passes after the append-only presentation change-control record.

## Browser proof

- `/about`, desktop light: visible policy link, decorative background semantics, zero overflow, clean console.
- `/about`, 390×844 dark: disclosure visible, correct dark engraving active, zero overflow, clean console.
- `/country/greenland`: territory landmark caption, exact visible disclosure, non-documentary accessible name, zero overflow.
- `/licensing#imagery`: anchor lands in view; `Editorial illustrations`, the non-documentary/source-evidence limits, and the manifest link are present; zero overflow and clean console.
