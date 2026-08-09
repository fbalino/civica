# Civica typography lab — implementation note

Date: 2026-07-13

## Visual thesis

The type lab should feel like a quiet proofing instrument laid over the real
Civica Atlas, not like a new branded surface. It uses the existing paper,
ink, hairline, radius, spacing, shadow, and control tokens, then gets out of
the way so typography can be judged in context.

## Content plan

The compact floating panel contains:

1. A pair preset for quick comparisons.
2. Independent serif and sans selectors.
3. A serif cut selector focused on Light, Regular, and Medium.
4. A plain-language loading/error status.
5. A reset action that restores Source Serif 4 + Inter.

The controls operate on the real site. No separate specimen page is needed;
the home page, country pages, data tables, methodology pages, dark mode, and
mobile layouts are the specimens.

## Interaction thesis

Selection swaps the canonical `--font-heading` and `--font-body` variables
immediately, persists locally across navigation, and never changes production
assets or public design-system defaults. The panel expands/collapses with the
existing motion tokens and respects reduced-motion preferences.

## Size-control extension

Visual thesis: the size controls remain part of the same quiet proofing
instrument—two compact typographic scales, not a second control system.

Content plan: add one continuously adjustable percentage control beneath each
family selector, with the current percentage always visible and Reset restoring
both to 100%.

Interaction thesis: resizing happens at the loaded font-face level, so every
existing heading or interface/body text role responds immediately without
changing Civica's semantic text-size tokens. Typeface changes preserve the two
chosen percentages, making comparisons consistent across families.

A third global leading control scales the canonical `--leading-*` token family
from the browser's live baseline. This preserves Civica's tight-to-loose
hierarchy while revealing how each size choice behaves in paragraphs, labels,
and display headings.

## Guardrails

- Render the lab only in local development.
- Serve only explicitly whitelisted local test webfonts, and return 404 in
  production.
- Do not copy trial font binaries into the repository.
- Keep official OFL comparison binaries in gitignored
  `local/type-lab-fonts/`; label every family and pair as Free or Paid in the
  controls.
- Use `local()` for desktop-only Lyon Display and ABC Diatype trials.
- Use Civica design tokens throughout the toolbar.
- Keep Source Serif 4 + Inter as the production default and reset state.
