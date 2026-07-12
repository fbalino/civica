# PUL-033 verification

Verified on 2026-07-12.

## Live state

- Production records all 26 authoritative migrations and matches fingerprint
  `77923b09ba1780b8b11a924b73e0b3a7b3db738122798f9ee3760a7784dccfcb`.
- The complete migration path passed on fresh PostgreSQL 17.
- The pre-contract queue contained 175 current events and 175 distinct
  incidents. All 175 are retained unpublished as `legacy_quarantined`, with
  no human-review or rejection claim and one append-only boundary event each.
- The active review queue has zero items, zero breaches, zero active
  exceptions, and no duplicate incidents.
- Research retention passes live with 34 mutable protected relations, five
  append-only Pulse evidence relations, and 66,526 history rows at the closing
  check.
- A scheduled `pulse-v2.8-beta` classifier run timed out before claiming any
  cluster. It had zero attempt or model-call evidence and was closed as failed;
  the incident invariant is clean.

## Contract and repository checks

- Eight SLA golden tests cover exhaustive priority mapping, UTC deadline
  arithmetic, exact deadline boundaries, exceptions, dispositions, legacy
  quarantine, daily health, and fail-closed timestamps.
- `npm run validate:claims-docs`: all seven categories and 898 tests pass.
- `npm run validate:pulse-review-sla:live`: passed against the shared report
  loader and an independent database census.
- `npm run validate:pulse-incidents:live`: passed.
- `npm run validate:research-evidence-retention -- --live`: passed.
- `npm run validate:authoritative-migrations -- --live`: passed at 26/26.
- `npm run validate:index-change-control`: passed at
  `civica-index-pulse-review-sla-v17` over 97 protected files and eight
  declared validations.
- `npm run validate:design-tokens`: passed with no new violations.
- `npm run build`: passed, including 105 static pages. The known Turbopack NFT
  tracing warning remains non-fatal.

## Reader and browser checks

- The public Pulse changelog rendered at 1440×1000 in light and dark modes
  with no visible overflow or design-system drift.
- The page states the latest available event date, distinguishes the 175-row
  legacy quarantine from human review, and says that a current SLA state does
  not establish daily completeness.
- The methodology page rendered with the versioned targets and exception rule.
- Browser verification exposed and closed one live timestamp-parameter bug;
  the shared report now returns 204 published rows, the current event result
  set, and the exact SLA census instead of falling into its unavailable state.
