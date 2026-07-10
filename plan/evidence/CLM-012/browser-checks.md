# CLM-012 browser checks

Status: **PASS**

- Fresh production build served at `http://localhost:3100`
- Route: `/api-docs`
- Viewports: desktop `1440 × 1000`; mobile `390 × 844`
- Browser: headless Google Chrome through Playwright
- Desktop: light theme; mobile: dark theme; reduced motion enabled

## Assertions

- HTTP 200 at both viewports.
- The `Public API` title, endpoint navigation, parameters, response notes, and generated examples render.
- All 15 JSON example blocks parse with `JSON.parse`; no invalid generated payload renders.
- Deprecation notices distinguish always-deprecated endpoints from the conditional structural/regime taxonomy branch.
- Mobile `data-theme` is `dark`, reduced-motion preference is active, and there is no document-level horizontal overflow.
- Long code blocks use their own horizontal scrolling without widening the page.
- No browser console or page errors occur in the production build.

## Visual inspection

Both final full-page screenshots were inspected. The endpoint hierarchy, status chips, parameter tables, deprecation notices, examples, and desktop sidebar remain legible and contained in light and dark themes. No acceptance-blocking overlap, clipping, or contrast defect is visible.

## Screenshots

- `api-docs-desktop-light.png`
- `api-docs-mobile-dark.png`
