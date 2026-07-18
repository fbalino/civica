# QA-012 — Automated accessibility and keyboard journeys

## Status

In progress. The Playwright harness now has a dedicated accessibility command:

```sh
npm run test:e2e:a11y
```

It injects the lockfile-pinned `axe-core` browser runtime (verified against
Deque's official Playwright package documentation on 2026-07-18) to audit
representative canonical reader routes and selected states in both themes. Each
audit attaches its compact result JSON to the retained Playwright output; WCAG
A/AA violations, including browser-evaluated contrast failures, fail the test
with affected selectors. This preserves the hash of the already frozen review
packet, which includes `package-lock.json` as an immutable input.

The complementary keyboard suite exercises the desktop Explore disclosure,
mobile menu focus trap/Escape restoration, country search selection, and the
shared segmented-control arrow-key/roving-focus behavior. The generic
`SegmentedControl` now implements arrow, Home, and End movement for every
consumer instead of advertising `tablist` semantics with click-only behavior.

## Remaining evidence before completion

1. Run the new suite against an isolated application build and retain the
   report/screenshot artifacts, then repair every uncovered violation rather
   than adding suppressions.
2. Extend the scenario ledger to the remaining reader/admin states and every
   control class (filters, drawers, lightboxes, maps, charts, tables,
   accordions, and forms) after the isolated fixtures in QA-011 are available.
3. Archive browser/assistive-technology review evidence and the contrast
   findings in `plan/evidence/QA-012/`; update the master checklist only when
   the full state/control matrix is proven.
