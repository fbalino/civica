# PUL-009 evidence

## Outcome

`pulse-observability/country-period-v1` adds a separate observability block to the versioned country-dimensions API. Observation state and event observation are independent. Low coverage, a current source outage, and a sourced restricted information environment cannot masquerade as a no-event finding. A period with no qualifying event always withholds the numeric effect and prohibits country-quality inference.

The current operational threshold for a no-event statement is retained evidence from at least two operating feed families and at least five country-period documents. This is a disclosure threshold, not a validated estimate of retrieval recall. The approximate static press-freedom fallback cannot create a restricted-information state; PUL-010 must supply a complete, versioned source before that state appears live.

## Live API checks

Checked `/api/v1/pulse/:country_slug/dimensions` on 2026-07-11:

- Japan: `sufficient_observation` / `no_qualifying_event_observed`; seven documents from GDELT and Human Rights Watch; every dimensional delta is `null`.
- Uruguay: `low_coverage` / `not_assessable`; two GDELT documents; every dimensional delta is `null`.
- Eritrea: `low_coverage` / `not_assessable`; no retained country-period documents; every dimensional delta is `null`.
- China: `sufficient_observation` / `qualifying_event_observed`; sixteen documents across four operating feed families and one qualifying event.
- Brazil: `low_coverage` / `qualifying_event_observed`; twenty-three documents from one operating feed family and six qualifying events. The event-based experimental deltas remain distinct from the broader low-coverage verdict.

These values are live observations rather than a frozen release. The contract, not the named country values, is the durable evidence.

## Canonical artifacts

- Resolution: `plan/research/pulse-country-period-observability-v1.md`
- Pure state model: `src/lib/pulse/v2/observability.ts`
- Live loader: `src/lib/pulse/v2/observability-live.ts`
- Golden fixtures: `src/lib/pulse/v2/observability.test.ts`
- Strict API contract: `src/lib/api/contract/pulse-observability-contract.test.ts`
- Public endpoint: `/api/v1/pulse/:country_slug/dimensions`
- Public methodology: `/civica-index/methodology/pulse#observability`
- Runtime method: `pulse-v2.5-beta`
- Durable decision: `APR-D117`

## Boundaries

The method uses current operating-feed state and retained retrieval-time evidence. It does not reconstruct every historical outage inside the period, establish source representativeness, or measure missed-event recall. PUL-022 owns those evaluations. PUL-035 owns cleanup of stale internal zero-delta rows; the public API already renders absence as `null` and rejects a numeric value when no event contributes.

## Verification

```sh
npm run validate:pulse-observability
npm run validate:pulse-runtime:live
npm run validate:api-docs
npm run validate:index-change-control:run
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```

The full suite contains 786 passing tests. The production build renders 98 static pages and retains the pre-existing non-fatal Next.js NFT trace warning from `next.config.ts`.
