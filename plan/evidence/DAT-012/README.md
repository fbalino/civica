# DAT-012 — Adapter repeatability (in progress)

## Pulse v2 implementation wave

The five-stage Pulse v2 pipeline now exposes a real zero-write dry-run path
and deterministic fixture seams across ingest, clustering, classification,
corroboration, and scoring. The end-to-end CLI and each stage CLI accept
`--dry-run`.

Retry safety is enforced at the database boundary. A Pulse event is unique per
cluster, and a raw source event can link only once. Migration 0022 backfilled
the cluster key for all existing events before adding both unique indexes.

Twenty-three focused tests prove:

- stable dry-run reports with zero writes;
- two applications converge on identical canonical state without duplicates;
- malformed fixture/model output fails before writes;
- empty derived inputs are explicit no-ops; and
- duplicate raw-event ingestion cannot stamp source freshness.

## Verification for this wave

- TypeScript: pass.
- Targeted ESLint: pass.
- Pulse runtime-method contract: 545 checks pass.
- Schema data dictionary: 49 tables / 571 columns pass.
- Source-freshness write-path validator: pass.
- Pulse fixture suite: 23/23 pass.
- Full unit suite: 469/469 pass.
- Full production build, claims/docs aggregate gate, and route generation: pass.
- Live migration audit: 384 events, no null cluster keys, no duplicate raw-event
  source groups, and both unique indexes present.

DAT-012 remains open. These results cover the four registered Pulse pipelines;
the remaining production adapter families still require the same contract and
the final repository-wide acceptance run.
