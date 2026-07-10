# CLM-016 production browser checks

Chrome checks used the final production build.

## Policy page

- `/policies` rendered the methodology sidebar, canonical title, policy `v1.0` metadata, current reconciliation/Pulse versions, and all eight sidebar sections.
- At 1440 × 1000 light mode, the page had no horizontal overflow and the warning/first policy section remained legible within the canonical editorial layout.
- At 390 × 844 dark mode, `/policies#notification` landed the heading at approximately 72px from the viewport top, below the 56px sticky header, with no horizontal overflow.
- The shared editorial anchor rule now gives `h2`/`h3`/`h4` IDs the same header-safe scroll offset across methodology pages.
- Screenshots: `policies-desktop-light.png`, `policies-mobile-dark-notification.png`.

## Reciprocal links and correction posture

- `/civica-index` rendered exactly one direct link for each required policy anchor: corrections, retractions, versioning, and known limitations, even when the data branch is empty.
- `/civica-conditions` rendered its corrections and known-limitations links without horizontal overflow.
- `/civica-index/corrections` rendered links to both the governing corrections policy and Data & API corrections section.
- The visible copy said: initial review target 7 days, full disposition target 30 days, best-effort and not guaranteed.
- No form was submitted and no database row was created during QA.
- Fresh production browser logs contained zero warnings or errors.
