# ATL-030 — Conditions codebook and replication evidence

Status: public codebook, one-command fixture reproduction, and dedicated local
tests complete; release-specific reproduction pending isolated staging.

`content/methodology-conditions.md` is the public codebook source rendered at
`/civica-conditions/methodology`. It documents definitions, native inputs,
units, transformations, release-specific reference populations, strict
same-year alignment, explicit missing/refused states, uncertainty/nonclaims,
coverage semantics, and the no-composite resolution.

The dedicated `npm run validate:conditions-components` command passed all 19
focused Conditions tests on 2026-07-23. It covers component persistence,
repeatability, migrations, immutable release writing, public release
selection/coverage, and the economic-construct boundary; it does not borrow
generic Index tests.

ATL-030 stays open until a captured staging release is reproduced from retained
source inputs and its release ID, manifest hash, component rows, coverage, and
public read are independently reconciled. The current evidence does not claim
that a real Conditions release exists.
