# EXP-015 owner review — 2026-08-09

> **SUPERSEDED 2026-08-17.** Fernando rejected the image-led Explore
> megamenu direction and replaced it with a standard grouped header dropdown
> (commit `a8f58bcc`, PR #24). This document is retained unchanged as the
> historical record of the superseded direction; it does not describe what
> Civica ships. The current contract is the "Explore dropdown" entry in
> `DESIGN.md`.

> **Date correction (recorded 2026-08-09).** This record was created with a 2026-08-09 session date. Fernando stated on 2026-08-09 that he had not worked on the project since late July 2026; the owner statements recorded here were made in the late-July 2026 working sessions, and the 2026-08-09 date is an artifact of when the record was written.


Disposition: **revise**. Fernando reviewed the rendered large Explore
candidate and rejected its current interaction and composition details while
keeping the image-led, near-page-width direction and the approved masters.

Owner findings, verbatim in substance:

1. The hover effects feel cheap (lift + shadow + image zoom + accent
   underline + arrow slide stacked on one card).
2. The engravings do not fit their containers (square masters letterboxed in
   4:3 tiles).
3. There is a visibly larger gutter between the first four cards and the last
   four (register gap wider than the card gap).
4. The panel's open animation needs fixing.
5. Remove the headline "Start with a place. Follow the evidence."

Revisions applied the same day (Claude session, this branch):

- Card hover reduced to one quiet response: accent-tinted border/background
  plus arrow color, `--motion-fast` + `--motion-ease-out`. The lift, shadow
  jump, image zoom, scaleX underline, and arrow translation are removed.
- Art tiles are square (`aspect-ratio: 1`) so the square masters render
  full-bleed with no letterbox seam.
- The inter-register gutter now equals the card gutter (`--space-3`); the
  register labels alone carry the grouping.
- The panel now has a real entrance: `@starting-style` fade-and-settle from
  the header (opacity `--motion-fast`, transform `--motion-base`, both
  `--motion-ease-out`, origin top); reduced motion keeps only the fade; close
  remains an instant unmount. The shared `.nav-dropdown-menu` easing moved
  from built-in `ease` to `--motion-ease-out`.
- The headline is removed; the panel header is one slim eyebrow + dek row.

DESIGN.md's Explore megamenu entry was updated in the same change. This
record is the rendered-candidate disposition requested by the owner action
runbook; it is not an approval of the revised rendering (that review is still
open) and not deployment authority.
