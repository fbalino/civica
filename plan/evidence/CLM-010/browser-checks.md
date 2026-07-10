# CLM-010 browser checks

Status: **PASS**

- Production build: `http://127.0.0.1:3110`
- Route: `/civica-index/replication`
- Viewports: desktop `1440 × 1000`; mobile `390 × 844`
- Browser: headless Chromium via Playwright 1.59.1
- Motion preference: `prefers-reduced-motion: reduce`

## Assertions

- HTTP 200 at both viewports.
- `Replication status`, the `Not published` Chip, and the exact registered warning render above the component inventory.
- Nine required component rows render from the canonical status object: two `In progress`, six `Planned`, one `Deferred`, and zero `Available`.
- No artifact/CSV/codebook/checksum/DOI link or download attribute renders.
- Desktop document width is `1440/1440`; mobile is `390/390`. There is no document-level horizontal overflow.
- The canonical table wrapper uses `overflow-x: auto`: desktop `1327/800` and `scrollLeft 0 → 527`; mobile `1327/350` and `scrollLeft 0 → 977`.
- The real theme control changes both `data-theme` and `localStorage.theme` from light to dark at desktop and mobile sizes.
- Reduced-motion preference is active; all status content remains visible.
- Keyboard Tab navigation reaches the site link, theme/menu controls, methodology sidebar links, breadcrumb, table scroll region, and citation disclosure.
- No console errors, HTTP 4xx/5xx responses, `NaN`, `undefined`, or unresolved `{{...}}` text.

## Visual inspection

All four final screenshots were inspected. The status and warning precede the inventory, light/dark contrast is legible, the table is contained, and no acceptance-blocking overlap or clipping is present. The floating Design control is local owner tooling and not part of the replication surface.

## Screenshots

- `clm010-replication-desktop-light.png`
- `clm010-replication-desktop-dark.png`
- `clm010-replication-mobile-light.png`
- `clm010-replication-mobile-dark.png`
