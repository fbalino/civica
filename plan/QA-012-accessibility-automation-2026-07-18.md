# QA-012 — Automated accessibility and keyboard journeys

## Status

Partial implementation and browser verification complete; QA-012 remains open
until its full control and admin-state matrix is covered. The Playwright
harness now has a dedicated accessibility command:

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

The isolated real-browser run on 2026-07-18 passed all 26 current checks with
no axe suppressions: 22 WCAG A/AA route-and-theme audits plus four keyboard
journeys. Its command, covered states, repaired findings, and retained output
location are recorded in `plan/evidence/QA-012/README.md`.

## Remaining evidence before completion

1. Extend the scenario ledger to the remaining reader/admin states and every
   control class (filters, drawers, lightboxes, maps, charts, tables,
   accordions, and forms) after the isolated fixtures in QA-011 are available.
2. Archive browser/assistive-technology review evidence and the contrast
   findings in `plan/evidence/QA-012/`; update the master checklist only when
   the full state/control matrix is proven.
