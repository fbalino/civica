# PUL-008 evidence

## Outcome

Pulse feed status now comes from one shared `pulse-source-coverage/v1` report. A connector can appear operating only when the current runtime declares a real connector, retained run telemetry records a successful retrieval, retained evidence exists, and source-input and rights records are registered. Failed latest attempts are degraded. Access-gated, placeholder, and unobserved feeds remain inactive.

The public methodology, versioned API, and admin review dashboard consume the same report. Each feed exposes successful and failed retained runs, latest attempt and outcome, fetched/yielded/inserted rows, retained evidence and latest data time, observed languages and ISO3 jurisdictions, unresolved jurisdiction rows, rights posture, and declared blind spots.

## Production evidence

The applied ingest run fetched 292 records: 12 Amnesty, 10 CIVICUS, 250 GDELT, and 20 Human Rights Watch. It inserted 128 new GDELT rows, recognized 164 duplicates, and recorded 14 unmatched-country results. The run persisted connector-specific telemetry in the immutable pipeline-run counts.

The live report returns four operating feeds—Amnesty, CIVICUS, GDELT, and Human Rights Watch—zero degraded feeds, and six inactive feeds. ACLED, AP, IPU, Reuters, RSF, and V-Dem do not acquire operating status from a stub, access declaration, or code presence. The endpoint standing is `operational_observability_not_retrieval_validation`.

That paragraph records the original 2026-07-11 acceptance observation; it is
not a promise about current operations. The read-only 2026-07-14 audit at
`source-coverage-audit-2026-07-14.json` found three operating feeds, one
degraded feed, and six inactive feeds because GDELT's latest retained attempt
failed. Operational state is allowed to change as telemetry changes.

Rights remain fail-closed. The operating sources have pending source-specific terms records, and bulk redistribution remains blocked or pending review according to the rights manifest. Unregistered inactive feeds report missing rights rather than inheriting a permissive default.

## Canonical artifacts

- Resolution: `plan/research/pulse-source-coverage-v1.md`
- Shared report: `src/lib/pulse/v2/source-coverage.ts`
- Retrieval telemetry: `src/lib/pulse/v2/ingest.ts`
- Public API: `/api/v1/pulse/source-coverage`
- Public methodology: `/civica-index/methodology/pulse#sources`
- Admin operations view: `/admin/pulse-review`
- Runtime method: `pulse-v2.4-beta`
- Source-coverage schema: `pulse-source-coverage/v1`
- Durable decision: `APR-D116`

## Boundaries

This report proves observed connector operation and retained scope. It does not prove representative retrieval, measure country-period observability, or turn an absence of qualifying events into evidence of stability. PUL-009 owns country-period observability states; PUL-022 owns retrieval-recall and outage evaluation. Source-rights review also remains pending where the rights manifest says so.

## Verification

### PLT-001 offline/live split — 2026-07-14

The normal validator now checks a full, dated, SHA-256-sealed report without a
database connection. It binds every feed to the exact runtime connector,
source-input and rights posture, activation and blind spots; derives state
from retrieval/evidence conditions; reconciles telemetry, evidence, time, and
summary fields; and proves that the capture was read-only with zero writes.
Seeded tests reject resealed structural, registry, rights, state, telemetry,
evidence, timestamp, and provenance drift. The static artifact is historical
acceptance evidence only. `npm run validate:pulse-source-coverage:live` is the
explicit read-only comparison with current Neon and does not require the live
state to equal the dated snapshot.

See `browser-checks.md` for responsive theme checks and screenshots. The following checks pass:

```sh
npm run validate:pulse-source-coverage
npm run validate:pulse-source-coverage:live
npm run validate:pulse-runtime:live
npm run validate:pulse-version-lineage:live
npm run validate:design-tokens
npm run validate:index-change-control:run
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```

The full suite contains 778 passing tests. The production build renders 98 static pages and retains the pre-existing non-fatal Next.js NFT trace warning from `next.config.ts`.
