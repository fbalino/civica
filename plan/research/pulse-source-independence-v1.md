# Pulse source-independence resolution v1

**Status:** adopted for production corroboration  
**Method:** `pulse-source-independence/evidence-family-v1`  
**Corroboration algorithm:** `pulse-corroboration/evidence-family-v3`  
**Runtime method:** `pulse-v2.3-beta`  
**Date:** 2026-07-11

## Construct and counting unit

Pulse corroboration counts independent evidence groups attached to one event. It does not count connector rows, URLs, or publisher names as automatically independent. The method is intended to prevent a wire story, syndication copy, mirrored NGO release, or article citing one underlying report from increasing the heuristic weight merely because it appears in another row.

This is a dependency detector, not proof of editorial independence. Two groups remain distinct when the retained evidence shows no declared dependency. They may still share undisclosed reporting, ownership, or incentives.

## Frozen pairwise rules

Two reports belong to one dependent group when the first applicable rule finds:

1. the same immutable raw-evidence snapshot;
2. the same canonical URL after fragment and tracking-parameter removal;
3. the same normalized publisher family;
4. the same named underlying origin, including a wire or specialist organization; or
5. exact or near-verbatim normalized event text.

Pairwise dependencies are joined transitively. If a specialist report and a news copy share a group, the group is specialist evidence. Aggregated-news rows use the recorded publisher host. Direct connectors use a fixed organization-family registry, so an NGO mirror cannot create another family. An unresolved aggregated-news publisher receives the shared `unresolved-publisher` family within an event and therefore fails closed rather than creating apparent diversity.

The rules and similarity threshold are versioned together. Changing an alias, origin pattern, normalization rule, similarity threshold, or unresolved-publisher policy requires a new source-independence version.

## Preregistered regression gate

Before detector evaluation, the v1 fixture labels froze seven dependent pairs and five distinct-evidence pairs. The dependent cases cover tracking variants of one URL, two domains in one publisher family, Reuters and AP syndication, a news reference to an Amnesty report, near-verbatim republication, and an HRW mirror. The negative cases cover distinct specialist organizations, separate wire services, independent local reporting, and distinct evidence about the same event.

The predeclared minimum pairwise precision is 0.95 and the minimum recall is 0.90. The frozen fixture produces precision 1.00 and recall 1.00. This is a regression gate over designed cases, not representative validation. The checked fixture and executable calculation live in `src/lib/pulse/v2/source-independence.test.ts`.

## Production audit

The pre-application live audit found 529 retained reports attached to 384 events. The v1 rules derived 439 evidence groups and collapsed at least one dependency in 30 events. They identified 59 same-publisher pairs and 580 near-verbatim pairs. No retained report in this snapshot had an unresolved aggregated-news publisher. The largest event had 41 reports and 11 derived groups.

These counts describe stored evidence. They do not estimate precision, recall, source independence, event truth, or coverage. Payload text remains private under the raw-evidence rights contract.

The zero-write corroboration run examined all 384 events. Relative to the prior connector-ID method, 157 confidence values increased materially because reports from separately identified publishers can now form separate groups. No value decreased materially; the apparent decreases below 0.000001 were storage-precision noise. Mean planned corroboration confidence moved from approximately 0.350 to 0.353. This small average change does not validate the weights.

## Known failure modes

- A paraphrased copy may evade the near-verbatim rule.
- Two publishers may depend on one unnamed source.
- Publisher-family aliases are incomplete and require versioned maintenance.
- The shared unresolved-publisher family can merge genuinely separate reporting.
- Transitive grouping can propagate one false dependent edge through a larger group.
- The detector does not establish state ownership, editorial control, or statistical independence.

PUL-023 owns representative held-out event and pair evaluation. PUL-011 owns separately persisted corroboration decisions. PUL-008 and PUL-009 own operating-source coverage and observability. Failure of later preregistered accuracy gates requires a new method version; the v1 fixture thresholds may not be relaxed after seeing those results.
