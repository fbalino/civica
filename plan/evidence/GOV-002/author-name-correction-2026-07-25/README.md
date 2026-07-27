# GOV-002 clerical author-name correction

Date: 2026-07-25

Status: applied to mutable canonical records

## Correction

The accountable author and owner is **Fernando Baliño**. Earlier records that
spell the family name `Balino` refer to the same person. This is a clerical
diacritic correction only: it does not add a contributor, alter responsibility,
grant approval, or change any research method, data, score, or release result.

Current public copy, canonical citation metadata, authorship/governance
registries, policies, operational ownership records, validation assertions, and
future generated reviewer drafts now use `Fernando Baliño`.

## Preserved historical bytes

Already frozen release packets and `reviewer-dossiers-v1` retain their original
unaccented bytes so their published hashes and reproducibility claims remain
truthful. The old spelling in those artifacts is superseded as identity
metadata by this correction. Any future version generated from the canonical
sources must use `Fernando Baliño`.

Raw Git author strings are also not rewritten: where a checked audit reports
the literal historical identity `Fernando Balino <...>`, it describes Git
metadata rather than declaring the preferred current spelling. Generic admin
test fixtures using the same ASCII text are not identity records.

## Scope and verification

This patch requires no database or score migration. The canonical sources,
focused governance validators, full claims/documentation gate, typecheck,
design-token ratchet, build, and browser surfaces are checked before release.
An evidence-only Index change-control entry binds the corrected copy and tests
without claiming a methodology change.
