# QA-020 — machine-readable gate readiness reports

## Delivered

`civica-gate-readiness-report/v1` is a checked JSON report for G2, G4, G5,
and G6. It reads the canonical area plans and master mirror, completion log,
evidence directories, manual-check queue, and an explicit empty waiver
registry. Each gate reports totals by priority and area, all unresolved P0/P1
task IDs, missing completion evidence, linked manual-check task IDs, waivers,
and its closed command list.

The report is intentionally a status document, not a pass claim. A green
report requires every listed command to pass, no master/evidence blocker, and
no open P0 task. G4 additionally requires no open P1 task. G5 and G6 retain
their external-resolution blockers until real evidence exists. The opt-in
runner invokes program/argument tuples from source code only; it does not
shell-evaluate report data or store command output.

## Current truthful state

The checked report records 306 tasks: 215 complete, 91 remaining, 38 open P0,
and 86 open P0/P1 tasks. All gates are `blocked`. It identifies the existing
completion-record gaps for `IDX-037`, `ATL-007`, and `EXP-034`; it does not
invent evidence for them.

The live G2 runner was executed on 2026-07-18. Its five fixed commands passed:
master-plan integrity, G2 Atlas validation, offline Atlas reproduction,
clean-room validation, and release-quality-report integrity. Its overall
status remained `blocked` because readiness also requires complete plan
evidence and no open P0 work.

## Verification

```sh
npm run generate:readiness-reports
npm run validate:readiness-reports
npm run run:readiness-reports -- --gate=G2 --execute
npm run typecheck
node plan/tools/validate-master-plan.mjs
git diff --check
```

The focused contract test proves that an unchecked P0 cannot become green even
with passing commands, missing evidence/progress is visible, and a failed
allowlisted command fails the report.
