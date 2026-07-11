# PUL-016 evidence

## Outcome

`pulse-independent-coding/v1` gives two coders the same country-day evidence packet, adopted ontology, and 61-category operational boundary catalog while withholding production labels, publication state, model votes, numeric effects, owner approvals, peer submissions, adjudication, and purported gold answers.

The protocol separates packet outcome, observability, event identity, date, jurisdiction, evidence, ontology labels, effect direction, severity, candidate labels, and retrieval status. It gives uncertainty a structured `candidateEvents` path and makes agent dry runs permanently ineligible for a gold release.

## Training and blind pilot

`pulse-coder-pilot/v1` contains six descriptively named worked examples and twelve synthetic blind packets. Blind packets have no teaching answer and cover retained events, audit-only events, audit-bounded negatives, absent results, source outage, sourced restriction, republication, date mismatch, foreign-policy exclusion, routine emergency logistics, unresolved prosecution, and a multi-facet coup.

The pilot found three instruction/tooling defects before any human coding:

1. An unconstrained Spark response flattened the ontology annotation. The response was rejected, and a strict JSON output contract was added.
2. Parallel numeric names such as `TRAIN-002` and `PILOT-002` led two independent dry-run coders to substitute the training coup packet for the blind internet-shutdown packet. No submission was accepted. Training identifiers were replaced with descriptive names that cannot share a blind suffix, and the pilot artifact was regenerated before the final run.
3. Coder B initially repeated the primary jurisdiction in `affectedJurisdictions` on five events. The mechanical validator rejected the submission. The instructions now state that affected jurisdictions are distinct additional jurisdictions only; Coder B recoded independently after receiving only that schema feedback and without seeing Coder A's labels.

These rejected attempts are process findings, not coder results, accuracy evidence, or gold labels.

The accepted dry pilot used two separate GPT-5.3 Codex Spark sessions, `SP-CODER-A` and `SP-CODER-B`. Both passed every packet, evidence-link, date, retrieval, observability, ontology, blinding, and non-gold validator. They agreed on all 12 packet outcomes and on every tracked axis for nine packets. Three packets retain disagreement: effect direction for the peaceful transfer, severity for the internet shutdown, and both category boundary and severity for the coup's legislature-dissolution facet. No adjudication was performed.

The boundary catalog SHA-256 is `d9a29f801d8b80add2d7cd386912fbbc4b59e13e749167c256425d1a625b877c`. The regenerated synthetic pilot SHA-256 is `253084b08f73fd0cc19122621a737ea0d6983c18066b943b660d7453d02ece55`. The combined raw-submission and disagreement artifact SHA-256 is `f3bb38909f7dd03d68b622dc44ab5739ddb6eae553c7b708676d7c7917d1ddaa`.

Twelve-of-twelve outcome agreement in a small synthetic same-model pilot is an instruction diagnostic only. It is not accuracy, inter-coder reliability, construct validity, human agreement, or evidence that the category answer is correct.

## Adjudication boundary

Every axis disagreement remains visible after both submissions lock. Adjudication is separate, preserves both raw submissions, records a reason code and evidence, and may leave an item unresolved. Two-coder majority voting is prohibited. Only a qualified human adjudicator may contribute to a later gold release; owner preference, production output, model consensus, and agent dry runs cannot.

## Method sources

- [Klie, de Castilho, and Gurevych (2024)](https://aclanthology.org/2024.cl-3.1/)
- [Mitamura et al. (2015)](https://aclanthology.org/W15-0809/)
- [Cofie, Braund, and Dalgarno (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9099179/)

## Verification

```sh
npm run generate:pulse-coder-pilot
npm run validate:pulse-coder-protocol
npx tsc --noEmit
npx eslint src/lib/pulse/v2/coder-protocol.ts src/lib/pulse/v2/coder-protocol.test.ts scripts/generate-pulse-coder-pilot.ts scripts/generate-pulse-coder-agent-pilot-results.ts scripts/validate-pulse-coder-protocol.ts
npm test
npm run validate:claims-docs
npm run build
```

PUL-017 owns the access-controlled double-coding application. This task prepares and tests the instructions; it does not replace independent human coding or external review.
