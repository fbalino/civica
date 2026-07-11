# Pulse source-coverage resolution v1

**Status:** adopted for operating-source disclosure

**Contract:** `pulse-source-coverage/v1`

**Runtime method:** `pulse-v2.4-beta`
**Date:** 2026-07-11

## Problem

The previous runtime snapshot called a feed active when its source ID had appeared in `raw_events`. That answered a historical question, not an operational one. It could not show whether the latest retrieval succeeded, whether a configured connector was a stub, what the run yielded, or where retained evidence was thin. Several connectors also converted network failures into successful zero-row results.

## Operating-state contract

A feed is `operating` only when all of the following are true:

1. the runtime registry identifies a real production connector rather than a gated, configuration-only, sparse, or placeholder path;
2. connector-level telemetry exists for the latest retained ingest run;
3. that latest connector attempt succeeded;
4. the source has retained raw-evidence rows; and
5. its source-input and rights records exist.

An otherwise eligible feed is `degraded` when telemetry is missing, its latest retrieval failed, its rights/input contract is missing, or it has no retained evidence. Gated and stub connectors are `inactive`, and skipped orchestrator calls do not count as successful retrievals.

The runtime-method snapshot now calls its historical source-ID set `observedEvidence`. It is not an operating verdict. The live `/api/v1/pulse/source-coverage` response is authoritative for operating, degraded, and inactive state.

## Retained telemetry

Each immutable ingest run closes with per-connector counters for fetched, proposed, inserted, duplicate, unmatched-country, and failed outcomes. Failures remain in the run's component-failure record. Amnesty International and Human Rights Watch now run as separate connector components so one feed cannot hide the other's failure.

Active RSS and GDELT retrieval failures now propagate to the orchestrator and become failed component telemetry. Best-effort GDELT article-body enrichment remains nonfatal because the retained GDELT record and domain fallback survive; the primary document-API request does not.

## Public report

For every registered feed, the report publishes:

- current operating state and reason;
- successful and failed observed runs;
- latest attempt time and fetched, proposed, inserted, duplicate, and unmatched counts;
- retained row count and latest retained retrieval time;
- observed language codes, resolved ISO3 set, and unresolved-attribution count;
- source terms, review and public-export posture; and
- declared blind spots.

Observed scope describes retained evidence. It is not a claim of geographic or language completeness, retrieval recall, continuous observation, or source accuracy. `und` means the source did not supply a usable language code.

## Live adoption evidence

The first zero-write run fetched 42 Amnesty, CIVICUS, and HRW items while GDELT returned HTTP 429. That run exposed that the GDELT connector swallowed its primary retrieval failure. No rows or telemetry were written. After failure propagation and per-feed splitting were implemented, the applied run fetched 292 items: 12 Amnesty, 10 CIVICUS, 250 GDELT, and 20 HRW. It inserted 128 new GDELT rows and recognized 164 duplicates. The resulting report contains four operating feeds, no degraded feeds, and six inactive connectors.

All four operating source-rights records remain pending review, so their public publisher-payload export stays blocked or pending. Operating status is evidence of connector function, not permission to redistribute source content.

## Limits and next gates

The report observes at most the latest 30 telemetry-bearing ingest runs. The adoption release begins with one such run, so run-history counts are initially shallow. A successful zero-yield retrieval can remain operating when prior retained evidence exists; PUL-009 and PUL-022 must decide when sparse yield becomes low observability or an outage. PUL-024 owns drift alerts. PUL-030 owns production alert delivery and release safeguards.
