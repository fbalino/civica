# CLM-018 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with the in-app browser runtime.

## Desktop (1440×900)

- `/licensing#reuse`: no horizontal overflow; hash target clears the top navigation; the page identifies the registry as interim, states that no complete release manifest exists, states the code's unlicensed posture, and renders all seven artifact-class rows.
- `/about`, `/terms`, `/api-docs`, and `/civica-index/widget?c=denmark`: no horizontal overflow; each required access/reuse boundary or Licensing pointer is present.

## Mobile (390×844)

- `/licensing#reuse`, `/about`, `/terms`, `/api-docs`, and `/civica-index/widget?c=denmark`: no horizontal overflow; required rights language remains present; the licensing table retains all seven rows.

## Embeds

- `size=sm` at 300×80: fits the frame and carries `<meta name="civica:rights" content="https://civicaatlas.org/licensing#reuse">`; no visible rights line is required at this size.
- `size=md` at 320×180: card fits the frame; the canonical reuse pointer is visible rather than clipped. Browser QA found and corrected the pre-verification clipping condition.
- `size=lg` at 400×260: fits the frame; the canonical reuse pointer is visible.
- Fresh isolated loads of every changed rendered surface reported zero console warnings or errors. Two stale `MutationObserver` errors appeared only after repeatedly reusing an instrumented QA tab; isolated page loads were clean.

## Visual evidence

- `licensing-desktop.png`
- `licensing-mobile.png`
- `embed-medium.png`
