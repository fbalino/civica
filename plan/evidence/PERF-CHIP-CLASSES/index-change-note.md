# PERF-CHIP-CLASSES — Index change-control note: chips styled by classes

Change record: `perf-chip-classes-2026-10-15`.

## What changed in protected files

- The shared `Chip` component (also exported as `Pill`) renders CSS classes
  (`.ui-chip` plus a tone modifier) instead of an inline style object. The
  rules live in `src/app/editorial.css`. The Beta tag beside the country
  header and the `inHeading` Beta tag use two layout modifier classes in place
  of inline overrides.
- Protected Index pages that render a `Chip` (for example the Index
  methodology page and the Civica Data tab) therefore emit a short class
  string instead of about 430 bytes of inline style per chip.

## What did not change

No Index input selection, transform, weight, model, release, or presented
value changed. The same chips render with the same labels and computed
styles in light and dark mode; only the markup that carries the style is
smaller.

## Release and migration

No data migration. The change takes effect on the next page rebuild after
deploy. Rollback is a code revert; no stored data depends on the change.

## Verification

`src/components/editorial/chip.test.ts` pins the markup for every tone and
size. Computed styles of every chip on `/design-system`, the home page, a
country page, and the Civica Data tab were compared before and after in a
real browser in both themes. Also run: `npm run validate:design-tokens`,
`npm run validate:cache-consistency`, `npm run validate:claims-docs`,
`npm test`, and TypeScript.
