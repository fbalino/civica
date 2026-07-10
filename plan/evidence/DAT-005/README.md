# DAT-005 evidence — statement and fact-key provenance coverage

Status: implementation complete on 2026-07-10.

## Outcome

`fact-provenance-coverage/v1` publishes the first dataset-wide provenance
snapshot without conflating database lineage with compact UI disclosure. The
checked current report contains:

- 25,824 active publisher observation rows
- 17,516 jurisdiction/fact-key groups, all fully source-linked
- 13,201 groups with exactly one source ID
- 2,349 groups passing the conservative two-plus-native-publisher screen
- 0 unresolved fact disputes
- 0 stale non-frozen live rows under the declared 180-day retrieval rule
- 7,875/7,875 source-linked statement rows across 6,745 subject/predicate groups
- complete breakdowns for 253 countries/areas and 88 fact keys

The reader report is `/methodology/provenance-coverage`; the same checked JSON
is available at `/api/provenance-coverage`.

## Definitions

A fact is one active jurisdiction/fact-key group, regardless of how many
publisher observations sit behind it. It is source-linked only when every
active row resolves to a source registry entry with a license and a usable row-
or source-level URL.

Single-source means one distinct source ID. The two-plus-independent count is
deliberately conservative: native publisher IDs count as families; CIA
Factbook, Wikidata, and UN Data compilation rows do not add an independent
family when native publishers exist, and secondary-only evidence counts as one
family. DAT-006 still owns claim-level origin, republisher, and common-source
mapping, so the current independence count is published as provisional.

A stale row is an active, non-frozen-source row whose retrieval timestamp is
more than 180 days before report generation. Registered frozen archives are
excluded rather than mislabeled as failed live syncs.

## Executable contract

- `src/lib/provenance/fact-coverage.ts` — pure grouping, linkage,
  independence, dispute, staleness, and breakdown rules
- `scripts/generate-fact-coverage-report.ts` — live DB generator
- `src/lib/provenance/fact-coverage.generated.json` — checked current snapshot
- `scripts/validate-fact-coverage-report.ts` — DB-free aggregate/public-surface
  gate
- `src/lib/provenance/__tests__/fact-coverage.test.ts` — five focused and
  adversarial fixtures
- `src/app/(reader)/methodology/provenance-coverage/page.tsx` — reader report
- `src/app/api/provenance-coverage/route.ts` — machine-readable report

## Verification

- Snapshot aggregates close against both country and fact-key breakdowns.
- Statement linked plus unlinked counts close to the statement total.
- Public claim and numeric-claim registries bind the generated report.
- The data-approach page distinguishes the dataset report from the 4/10
  compact-renderer presentation audit.
- Desktop and 390×844 browser checks passed; four wide tables scroll inside
  canonical `DataTable` containers and browser logs were clean.
- TypeScript, focused ESLint, design-token validation, metadata/routes,
  claims/docs, 388 tests, production build, and master-plan validation passed.
