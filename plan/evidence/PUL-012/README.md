# PUL-012 evidence

## Outcome

`pulse-jurisdiction-attribution/v2` records one primary jurisdiction and zero
or more materially affected jurisdictions. Each resolved role has a canonical
name, ISO3, Civica id, role-specific rationale, headline/description evidence
references, and the exact entity snapshot used by the decision. The current
event row remains the primary compatibility projection; affected jurisdictions
are descriptive and do not silently receive the event's experimental numeric
effect.

The attribution prompt receives human-readable candidates from the
content-hashed `pulse-jurisdiction-entities/v1` catalog and
`pulse-jurisdiction-aliases/v1`, including the human-readable provisional
ingest guess. It is no longer shown only an internal UUID. Unknown ISO3 codes,
malformed role sets, supranational cases, and cases without one defensible
primary jurisdiction fail closed. An unresolved result blocks automatic
publication.

## Persistence and live migration

Authoritative migration `0018_rich_phalanx.sql` adds the append-only
`pulse_event_jurisdictions` relation. A database trigger materializes role rows
from the authoritative decision payload in the same transaction. The live
authoritative ledger is 19/19 with schema fingerprint
`ae7c8a0b85d637f45c1262722b3df138569283f5e349574580062e63b82f2acb`.

All 384 retained events have one normalized primary row. Every migrated row is
explicitly `pulse-jurisdiction-attribution/legacy-projection-v1`: no historical
alias input, multi-country judgment, or modern model rationale was invented.
The current catalog contains 253 entities and hashes to
`pulse-jurisdiction-entities/sha256:15e3f141548cab9e1dd16df650ecf2331a1781f4d75dfc8bad6ffb2a679c83e5`.

## Cross-border fixtures

The strict parser and resolver fixtures cover single-country, cross-border,
supranational, unclear, malformed multi-country, unknown ISO3, alias, and
human-readable context cases. The production-shaped database fixture inserted
one decision with one primary and one affected role, verified both normalized
rows, proved that updates are rejected, and deliberately rolled the transaction
back. Zero fixture rows remained.

## API and method contract

Runtime method `pulse-v2.8-beta` and schema `1.7.0` publish the attribution,
entity, alias, input-context, output-role, abstention, projection, and legacy
rules. The country-events API exposes attribution standing, version identities,
the requested jurisdiction's role, the primary row, and affected rows. A live
Turkey query returned 27 schema-valid events, all with the expected explicit
legacy standing and primary role.

Shared Index/Pulse change-control contract v8 protects 96 semantic files across
input, model, and presentation categories. It records that the Governance
Evidence Dashboard and Index calculations are unchanged.

## Boundaries

Fixture success establishes storage and contract behavior, not representative
attribution accuracy. The retained events were not re-run through the model.
PUL-014 through PUL-021 own sampling, independent coding, agreement, accuracy,
subgroup error, calibration, and comparative evaluation.

## Verification

```sh
npx tsc --noEmit
npm test
npm run validate:pulse-jurisdiction-attribution
npm run validate:pulse-jurisdiction-attribution:live
npm run validate:pulse-jurisdiction-attribution:fixture
npm run validate:pulse-runtime
npm run validate:authoritative-migrations:live
npm run validate:data-dictionary
npm run validate:index-change-control
npm run validate:design-tokens
npm run validate:claims-docs
npm run build
```

The full suite contains 801 passing tests. The production build renders 98
static pages. The pre-existing non-fatal Next.js file-tracing warning remains.
