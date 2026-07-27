# ATL-030 — Conditions codebook and replication evidence

Status: complete in the isolated QA-018 staging run.

`content/methodology-conditions.md` is the public codebook source rendered at
`/civica-conditions/methodology`. It documents definitions, native inputs,
units, transformations, release-specific reference populations, strict
same-year alignment, explicit missing/refused states, uncertainty/nonclaims,
coverage semantics, and the no-composite resolution.

The dedicated `npm run validate:conditions-components` command covers
component persistence,
repeatability, migrations, immutable release writing, public release
selection/coverage, and the economic-construct boundary; it does not borrow
generic Index tests.

[`release-reproduction.v1.json`](release-reproduction.v1.json) records the
release-specific capture/file hashes, 717 successful World Bank responses,
pre-write expectations, exact 340-key manifest replay, six protected-table
triggers, zero mutation-history rows, identical-input replay with zero inserted
scores/components, and a deliberately altered-input refusal with identical
before/after release and freshness state. The raw publisher responses are not
committed; only their capture and file hashes plus bounded results are retained.

The live release then reconciled to the public API and all reader surfaces via
`plan/evidence/ATL-029/release-reconciliation.v1.json`. This closes ATL-030's
release-specific staging criteria without claiming a production release.

The integrated production workflow also fails closed before publication unless
each World Bank economic component and the aligned all-component population
cover at least three quarters of the ISO-coded candidate spine. This guard
prevents a transport or publisher failure from publishing a nearly empty
global release while preserving honest missing-country rows once the admission
floor is met. Boundary and catastrophic-partial fixtures are retained in
[`coverage-admission-guard-2026-07-27.md`](coverage-admission-guard-2026-07-27.md).
