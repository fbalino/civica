# EXP-040 — Editorial prose link rules no longer restyle canonical buttons

**Commit:** this commit (fix(design): anchor masthead content and guard buttons).
**Root cause:** `.editorial-section a` (class+type, specificity 0-1-1)
outspecifies `.btn--primary` (0-1-0) on `color`, recoloring primary-button
text to the accent. On /civica-index this rendered the "Open the Governance
Evidence Dashboard" primary as accent-red text on the navy (near-black)
primary background in light mode, and accent-red on cream in dark mode.
**Change:** `.editorial-section a:not(.btn)` on the color and hover rules
(src/app/editorial.css) with an explanatory comment, plus a source-level
regression test `src/lib/design/editorial-button-guard.test.ts` that fails on
any unguarded prose-scope anchor selector (link-only component scopes are
consciously allowlisted).

## Verification (live computed styles, /civica-index, dev server)
- Before: page `.btn--primary` color `lab(60.852 34.3773 40.1507)` (accent)
  while the canonical header CTA showed `rgb(22,20,15)` ink on cream (dark).
- After: page button === header CTA in both themes measured
  (`rgb(11,27,45)` background / `rgb(250,247,242)` text under light;
  identical values for both elements under the dark measurement).

## Commands
- `node --import tsx --test src/lib/design/editorial-button-guard.test.ts` — 2/2 pass.
- `npm run validate:design-tokens` — pass (baseline unchanged at 410).

## Limitations
- The guard protects `.btn` inside editorial prose scopes; the broader
  pattern-map audit (EXP-002) still owns cataloguing every cascade seam.
