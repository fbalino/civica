# EXP-013 — valid, collision-free country hero caption

The engraving and caption now share a semantic `<figure>` parent. Its canonical `.factbook-hero-art-figure` wrapper uses `display: contents`, leaving the image and caption in the established masthead grid. The caption remains in the final `auto` row; the title/stats and Map/Images boxes occupy the flexible content row.

`ParallaxImage` now resolves the nearest enclosing section for scroll measurement. This avoids tracking the boxless figure while preserving reduced-motion and theme behavior.

## Proof

- `checkCountryCaptionDisclosure` requires the figure parent and includes a seeded invalid-parent failure.
- Exact browser geometry is in `geometry.json`. The browser's 90% zoom was corrected until `window.innerWidth` reported exactly 769 and 1440 CSS pixels.
- 769px system-dark: 66.48px caption row, 31.99px clear of content/media controls, no overlaps, inside hero, no horizontal overflow.
- 1440px light: 26.89px caption row, 31.98px clear of content/media controls, no overlaps, inside hero, no horizontal overflow.
- Both cases rendered a `FIGURE`; console warnings/errors were empty.
- `npm run validate:editorial-illustrations`, `npm run typecheck`, and `npm run validate:design-tokens` pass.

The shared header now enters the append-only Index presentation inventory because it can display research-score metadata; the EXP-013 change-control record binds the semantic/layout change without rewriting prior evidence.
