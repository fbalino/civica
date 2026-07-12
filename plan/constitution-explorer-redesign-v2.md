# Constitution Explorer redesign v2 — owner feedback 2026-07-01

Owner verdict on v1: "a mess… literally FOUR panes… convoluted and cramped";
country list has no evident order; circled + buttons are noise; the excerpt
card has broken padding, a duplicated heading, and over-rounded corners.

## Target layout — THREE zones, not four

The dedicated country-picker pane DIES. Country management moves into the
page header (the masthead line that already reads "France · compared with
India"):

```
CONSTITUTION EXPLORER
France · compared with India
[🇫🇷 France ×] [🇮🇳 India ×] [+ Add country]        ← header chips row
──────────────────────────────────────────────────
| OUTLINE        |  READING COLUMN      | COMPARE BY TOPIC |
| (existing nav) |  (existing serif)    | (existing pane)  |
```

- Header chips: one tonal chip per selected country (flag + name + ×;
  first chip = the one being READ, marked subtly — e.g. "Reading" affix
  like today's picker). × removes; removing the reading country promotes
  the next.
- "+ Add country" = a text-button that opens a SEARCHABLE POPOVER
  (anchored dropdown, same pattern as the almanac filter dropdowns):
  search input + ALPHABETICAL list of the 186 indexed countries
  (flag + name + year). Clicking a row adds it (cap 4) and closes.
  NO circled-plus icons — the row itself is the affordance.
- The left pane is now ONLY the outline (it already exists); middle and
  right unchanged in position. Grid goes from 4 tracks to 3; the freed
  width goes to the READING column (the point of the page).

## Excerpt-card fixes (Compare by topic pane)

1. **Duplicated heading**: the card shows an eyebrow ("368. POWER OF
   PARLIAMENT…" small-caps) AND the excerpt HTML's own first heading
   ("368. Power of Parliament…"). Keep the excerpt's own heading content;
   the card header should be ONLY: flag + country name (+ article label
   in the small-caps eyebrow IF the excerpt HTML does not begin with a
   heading whose text ≈ articleLabel — dedupe by normalized comparison,
   strip when duplicate).
2. **Padding**: clause-number markers currently hang into the margin /
   cramped edges. Normalize interior padding to var(--space-4) all round;
   excerpt paragraphs get their standard reading spacing; no negative
   margins from the sanitized `.content` markup (add a small scoped reset
   for `sup`/list markers inside `.constitution-xref` cards).
3. **Radius**: cards use var(--radius-md) (surface radius, NOT the pill-
   level rounding that read as "super rounded").

## Ordering
Everywhere a country list appears on this page: ALPHABETICAL by name.
(The old picker was population-ordered, which read as random.)

## Files
- src/components/constitution/ConstitutionExplorerShell.tsx — grid 4→3;
  header chips row + add-popover; remove the picker pane mount.
- src/components/constitution/ConstitutionCountryPicker.tsx — replaced by
  the popover (either rework in place or new ConstitutionAddCountry.tsx;
  delete dead code).
- src/components/constitution/ConstitutionCrossReferencePane.tsx — card
  header dedupe + structure.
- src/app/constitution/page.tsx — pass alphabetical country list; header
  chip data.
- src/app/editorial.css — .constitution-* grid/city updates, card padding/
  radius, header chips/popover styles (reuse .almanac-dd__* dropdown
  pattern where sensible — it's the same interaction).
- Keep: ?c= URL scheme, ?topic= seeding, reading column, scroll-spy,
  sanitizer, cross-ref fetch guards. Landing state (no ?c=) keeps its
  picker-as-content but ALPHABETIZED and without circled-plus.

## Verify
tsc; build; browser screenshots (light+dark): 3 zones, header chips,
alphabetical popover, excerpt card with single heading + clean padding.
/constitution?c=france&c=india must show the exact card from the owner's
screenshot FIXED (India 368 without the doubled title).
