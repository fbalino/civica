# CLM-011 browser checks

Status: **PASS**

- Fresh production build served at `http://127.0.0.1:3100`
- Route: `/country/methodology/reconciliation`
- Viewports: desktop `1440 × 1000`; mobile `390 × 844`
- Browser: headless Google Chrome 150 through Playwright
- Desktop: light theme; mobile: dark theme; reduced motion enabled

## Assertions

- HTTP 200 at both viewports.
- Page title and `Factbook Reconciliation` heading render.
- The current 300 percentage-point high-volatility threshold and computed 146.78 percentage-point Argentina gap render with correct spacing.
- No sealed “hot-fix,” “threshold raise,” pre-threshold, or prior-projection migration narrative renders.
- Mobile `data-theme` is `dark` and there is no document-level horizontal overflow.
- No browser console or page errors occur in the production build.

## Visual inspection

Both final full-page screenshots were inspected. The long-form methodology hierarchy remains legible, the sidebar and body do not overlap, light/dark contrast is intact, and no acceptance-blocking clipping or overflow is visible.

## Screenshots

- `reconciliation-desktop-light.png`
- `reconciliation-mobile-dark.png`
