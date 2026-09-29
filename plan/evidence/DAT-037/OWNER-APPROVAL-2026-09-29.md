# DAT-037 owner approval, 2026-09-29

Approver: Fernando Balino, Civica's accountable owner (GOV-001, GOV-005).
Given: in chat with Claude, the controlling agent, on 2026-09-29.
Recorded by: the controlling agent, from the owner's own words in that chat.

## What was approved

The owner answered "Yes, run it" to applying the DAT-037 cabinet-term repair
to production as rehearsed. The rehearsed repair method is
`cabinet-term-integrity-repair/v2` (second isolated rehearsal, 2026-09-29,
`cabinet-term-integrity-rehearsal-2026-09-29.json`). The approval covers the
four decisions the branch had assumed:

1. A CIA title that is renamed or dropped from the latest roster retires
   automatically, and a new title becomes a new position.
2. Duplicate and "Vacant" placeholder rows are removed. Every removed row
   keeps its audit copy in the permanent evidence history.
3. Order: deploy the corrected importer, refresh every country once, then run
   the repair.
4. The three unsourced United Kingdom legacy rows are retired. The five
   United States legacy rows stay current, keep their hand-entered dates, and
   are labelled unsourced.

## Public correction notice

The owner decided that no public correction record is created for this
repair: "Civica has no traffic, so you can just fix it without telling
anybody." Civica is prelaunch with no users (APR-D018 to APR-D020). The
decision is recorded as APR-D173 in `plan/DECISIONS.md`. The apply therefore
runs with `--public-correction=waived-prelaunch`, and the apply report
records that choice. The draft correction text in the DAT-037 README is not
published.

## Operations delegated to the controller

The owner assigned Claude, as controller, to pause and resume the Vercel cron
jobs, run the full CIA World Leaders refresh, and run the repair plan, apply,
and verification in the order the DAT-037 README gives.

## Plan binding

The production plan's SHA-256 is known only after the production plan run.
The controller appends it below, on a line of its own, after planning and
before apply. `--apply` refuses this file unless it contains the full SHA-256
of the plan being applied and names the method above. Before appending it,
the controller compares the production plan's categories with the rehearsal,
as the README's production sequence requires. The appended value records
which plan the owner's approval was applied to; the approval itself is the
owner's answer above.

Production plan SHA-256 (appended by the controller before apply):
