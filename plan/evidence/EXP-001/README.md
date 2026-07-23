# EXP-001 — rendered-module ledger

Status: agent-executable inventory and evidence infrastructure complete;
module-level visual review remains open.

## Checked inventory

`data/rendered-module-ledger.v1.json` currently contains:

- 71 rendered route/error/document identities;
- 211 unique source modules;
- 1,643 route-to-module relationships; and
- 6,572 required desktop/mobile × light/dark disposition cells.

The source graph is derived from the Git index rather than unrelated
working-tree edits. It includes tracked App Router pages, applicable layouts,
source-reachable TSX components, the standalone rendered
`/embed/[slug]` HTML document, and distinct error, global-error, and not-found
surfaces. JSON-only handlers remain in the separate route/security inventory.

## Durable evidence contract

`data/rendered-module-evidence.v1.json` is the review source of truth.
Regenerating the discovery artifact reapplies those records rather than
resetting completed review. The validator rejects:

- a duplicate route/module/variant record;
- a record whose route or module no longer exists;
- a `clean` result without a checked screenshot;
- a broad route-level record that tries to mark every reachable module clean;
  and
- a referenced screenshot that is missing.

The 68-image QA-013 candidate contains 64 unique route/variant contexts after
the separate open-menu state is excluded from overwriting the default home
context. Those records attach candidate screenshot context to 1,784 ledger
cells across 16 routes. Every one remains `not_observed` under
`EXP-001-CANDIDATE-NOT-REVIEWED`; none is promoted to clean evidence.

## Blocking enforcement

`npm run validate:rendered-module-ledger` rebuilds the ledger without writing,
compares it byte-for-byte with the checked artifact, validates every evidence
cell, and verifies screenshot existence. The canonical CI workflow runs that
command before its other repository gates, so a new rendered route/module or
stale review reference blocks the change.

## Remaining review

All 6,572 visual cells remain intentionally open. A reviewer must locate exact
modules in the named desktop/mobile and light/dark screenshots, add exact
module-source records, and classify each as `clean`, `finding`, or
`not_observed`. Route-level candidate context cannot satisfy that review.
Private admin/reviewer content must use safe fixtures and must never be placed
in checked screenshots.

EXP-001 remains unchecked. This evidence closes the agent-owned discovery,
persistence, and enforcement work without fabricating visual approval.
