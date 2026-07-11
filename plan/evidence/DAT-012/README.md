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

## Bills implementation wave

All six deployed bills adapters now use the same fail-closed runner and writer
contract. Every cron accepts `?dryRun=1`; dry runs skip both bill-table and
summary-cache writes. Inputs are validated as a complete batch before writing,
duplicate source keys are rejected, and empty upstream results fail loudly.

The writer now detects content-identical existing rows. A repeated fixture run
therefore performs no update, preserves the canonical row byte-for-byte, and
does not advance source freshness. Source-shaped fixtures cover the US, UK,
Canada, Germany, Brazil, and France adapters; the shared runner/writer fixtures
cover dry-run, malformed, duplicate, empty, and two-run convergence behavior.

After this wave, 476/476 tests and the full production build pass.

## Factbook external-sync boundary wave

All 18 external factbook cron adapters now expose `?dryRun=1` and share a
fail-closed outcome rule: any reported adapter error or zero usable rows makes
the cron fail instead of returning a misleading successful response. Their
freshness calls receive zero writable rows whenever any adapter error occurred,
so a partial or upstream-changed run cannot advance `sources.last_sync_at`.

This boundary wave does not complete the 18 adapters. Source-shaped parser and
two-run canonical-state fixtures are still required before DAT-012 can count
them as accepted.

After this boundary wave, 479/479 tests and the full production build pass.

## Factbook publisher-fixture tranche 1

World Bank WDI, IMF WEO, UN Data, and WHO GHO now expose bounded production
seams for source-shaped observations, jurisdiction catalogs, dispute handling,
and freshness. Production defaults are unchanged; fixtures can execute the real
normalization, envelope, snapshot, and country-fact code without network or a
live database.

For each of the four adapters, executable tests prove two applied runs converge
on one semantic canonical fact, dry-run reports are stable with zero database
writes, and an upstream failure is surfaced while freshness receives zero
writable rows. Twelve focused tests pass. The other factbook publishers remain
in progress.

After this tranche, 491/491 tests and the full production build pass.
