# CLM-003 evidence — Atlas-first product position

**Task:** Make the approved atlas-first sentence the working product position
across every primary public description.

**Commit:** `feat(editorial): establish atlas-first truthful positioning (CLM-003, CLM-004)`

## Outcome

- The visible homepage hero, About hero and prose, root/About metadata, Open
  Graph descriptions, social-card alt text, footer, README/template,
  `CITATION.cff`, `AGENTS.md`, and `DESIGN.md` now make the comparative atlas
  primary.
- The canonical sentence is: “Civica Atlas is a provenance-first comparative
  reference to how every country is governed.”
- The Civica Index and Pulse are described as secondary research experiments
  whose methods and outputs remain beta. Neither is required to survive its
  later validation gate.
- `plan/reviewer-brief.md` gives future reviewers the same posture while
  explicitly preventing outreach before G4 and owner approval.
- The existing `public/og-default.png` already carries the atlas-first headline
  “How every country is governed”; its programmatic alt text now uses the
  approved positioning.

## Verification

| Command or check | Result |
|---|---|
| `npm run validate:public-claims` | Exit 0 — 27 claims, 14/14 surfaces, 33 source/mirror markers, 0 unqualified high-authority phrases, and 0 unregistered headline claims. |
| `npm run validate:content-templates` | Exit 0 — 7 migrated content files clean, 0 unresolved paths or fallbacks. |
| `npm run regenerate:readme` | Exit 0 — generated README resolved live state/statistics with no fallback. |
| `npm test` | Exit 0 — all 47 top-level tests passed. |
| `npm run validate:design-tokens` | Exit 0 — no new token drift. |
| Targeted ESLint over every changed TypeScript/TSX file | Exit 0 with no warnings or errors. |
| `npm run build` | Exit 0 — compilation, TypeScript, and all 86 generated static pages passed; the pre-existing Turbopack broad-trace warning remains. |
| Production-server rendered audit over 10 named routes | Exit 0 — every route returned 200, carried the atlas position, and rendered no prohibited phrase or registry marker. |
| `node plan/tools/validate-master-plan.mjs` | Exit 0 — 288 master/area tasks agree, 4 complete. |

## Browser evidence

- The in-app browser exercised `/`, `/about`, `/civica-index`, both Index and
  Pulse methodology pages, Pulse changelog, advisory-board and application
  pages, Terms, and Licensing on the real local app.
- Light and dark desktop pages and a 390×844 mobile layout were inspected.
  The route audit found the canonical footer mission everywhere, no visible
  registry markers, no horizontal overflow, and no console warnings/errors.
- Screenshots:
  - `home-desktop-light.png`
  - `about-desktop-dark.png`

## Limitations and manual checks

- This task changes product posture; it does not prove the atlas complete or
  validate the Index/Pulse. Those claims remain gated by later work.
- No reviewer was contacted. Reviewer discovery and outreach remain blocked
  until the G4 agent-complete gate and explicit owner approval.
- No raster social card or engraving was regenerated because the existing
  social card is already semantically atlas-first and no design decision was
  required.
