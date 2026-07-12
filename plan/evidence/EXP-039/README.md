# EXP-039 — Country masthead grid anchors content to the hero base

**Commit:** this commit (fix(design): anchor masthead content and guard buttons).
**Root cause:** CLM-014 gave the caption its own final grid row. Inside the
fixed-aspect `.factbook-hero--art` both auto rows stretched equally, so the
caption row inflated (~248px at 1440x900) and the title/stat/tab block floated
to the vertical middle (296px of dead art below it).
**Change:** `grid-template-rows: minmax(0, 1fr) auto` on `.factbook-hero--art`
(src/app/factbook.css) with an explanatory comment.

## Geometry check (live computed styles, /country/andorra, dev server)

| Viewport | Theme | Rows (content/caption) | Gap below content block |
|---|---|---|---|
| 1440x900 (before) | dark | 376.1px / 247.9px | 296px |
| 1440x900 (after) | dark | 596.2px / 27.8px | 76px |
| 1024x800 (after) | dark | 516.2px / 27.8px | 76px |
| 769x800 (after) | dark | 388.9px / 27.8px | 76px (caption top 469, no overlap with content) |
| 1440x900 (after) | light | 596.2px / 27.8px | 76px |

The remaining 76px is the caption row plus its margin and the hero bottom
padding — the reserved caption region, exactly as CLM-014 intended. A full
light-mode 1440px screenshot was reviewed in the browser: title, government
line, stat strip, and tabs anchor at the hero base over the scrim; caption
bottom-right in its own row; map/images tiles at the base.

## Commands
- Browser geometry via computed styles on the running dev server (log above).
- `npm run validate:design-tokens` — pass (no new drift; baseline unchanged at 410).
- `node plan/tools/validate-master-plan.mjs` — pass.

## Limitations
- Screenshots are not persisted as files because the canonical browser harness
  (QA-009) does not exist yet; the geometry log above is the machine-checkable
  record. EXP-013/EXP-019 will add persisted screenshot coverage.
