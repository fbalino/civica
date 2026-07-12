# Footer Trust Strip Alignment Fix

Date: 2026-07-05

## Scope

Fix the homepage footer trust strip selected in browser feedback:

- Remove the extra left inset that makes the trust copy visually drift away from the site container.
- Keep typography, spacing, and colors on existing Civica design-system tokens.
- Verify on the local dev server with the in-app browser and run the design-token validator.

## Implementation Notes

- Touch only the shared footer styling in `src/app/globals.css` unless verification shows the markup needs to change.
- Preserve the trusted-source logo artwork and dark-mode asset swap.
- Use the standard `--max-w-content`, `--spacing-page-x`, `--space-*`, `--text-*`, `--font-*`, and semantic color tokens.
