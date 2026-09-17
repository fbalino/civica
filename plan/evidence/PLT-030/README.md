# PLT-030 — current release stabilization

**Opened:** 2026-09-17

## Status

Open. This record separates current release stabilization from the historical
G4 and production evidence retained elsewhere. No root cause, remediation,
passing build, deployment recovery, or live verification is claimed here.

## Recorded findings

1. The country-directory/data surface has a reported live discrepancy involving
   missing capital values.
2. The current CI/dependency audit has a reported critical finding.

## Completed repository hygiene

The owner-authorized 2026-09-17 cleanup deleted 21 obsolete remote branches
and closed obsolete pull requests 2, 3, and 4. The exact scope, heads, and
reasons are retained in `branch-cleanup-record-2026-09-17.json`. The record
lists four remaining live branches as an inventory only; it does not assert that
they are all active, mergeable, or required.

Dependabot pull requests 6, 7, 9, 10, 11, and 12 are deferred maintenance,
not release blockers; they are now closed with links retained and their remote
branches auto-deleted. Critical dependency pull requests 13 and 20 are superseded
only when their validated replacement is ready.

The canonical-source capital repair and its 229-row backfill have separate
owner authority, but no live write is claimed in this record. PLT-030 remains
open pending implementation and deployment evidence.

The implementation owners must add a dated, bounded record for each finding:
the named deployment or CI run, reproduction, affected scope, root cause,
remediation or containment, rollback posture, and replacement build/health and
affected reader-surface checks. Do not add secrets, raw production data, or
unredacted provider output.

PLT-030 stays open until the checklist `Done when` is met. Refresh PLT-025 only
after this evidence distinguishes current outcomes from historical checks.
