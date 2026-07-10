# SN5 CLM-015 — terminology implementation

Project root: `/Users/fernandobalino/Projects/civica`

You are the single implementation writer for CLM-015. Use at most 60 tool calls. Do not commit, use web search, edit project plan/checklist/progress/decisions/memory/state/evidence files, or touch unrelated user artifacts. Follow AGENTS.md and preserve the existing glossary design; this is not a redesign.

## Literal acceptance

Create and enforce a research terminology glossary for `source`, `observation`, `fact`, `reconciliation`, `estimate`, `indicator`, `index`, `signal`, `event`, `confidence`, `uncertainty`, `validation`, `replication`, and `peer review`. Done when the glossary is published, registered public docs link or conform to its definitions, and a terminology lint catches prohibited ambiguous usages in methodology content.

## Binding architecture

1. Add a canonical typed research-terminology registry under `src/lib/` containing exactly the 14 stable ids, display terms, normative definitions, relevant method links, registered methodology surfaces, and narrow lint rules.
2. `src/lib/data/glossary.ts` must import/generate the 14 public glossary entries from that registry. Do not copy their definitions into a second array. Preserve existing grouping/page rendering and existing tag palette; use optional/existing tags only.
3. Register one CLM-015 documentation concept in `src/lib/docs/doc-concepts.ts`: canonical terminology registry; public glossary generated from it; methodology/reconciliation/replication surfaces contract-tested for conformance. Update only directly affected doc-concepts tests.
4. Add a pure lint/registry test suite plus a thin DB-free `scripts/validate-research-terminology.ts`; add `validate:terminology` to package scripts and the build validation chain.
5. The validator must prove all 14 terms exist exactly once in the registry and generated glossary, ids are unique, every registered surface exists, every surface either carries a glossary link or passes terminology conformance, and seeded misleading phrases fail. Avoid brittle whole-file snapshots.

## Normative definitions

- **Source:** an identified publisher, dataset, document, feed, or instrument from which Civica obtains an input; its record carries origin, vintage/retrieval, rights, and freshness where available. Naming a source does not by itself establish independence or corroboration.
- **Observation:** one value or statement recorded for an entity and time by a source before Civica chooses among competing inputs. It retains source/vintage/method metadata.
- **Fact:** a publishable factual statement or value, explicitly classed as source-reported or reconciled and linked to provenance; not a claim of absolute or universal truth.
- **Reconciliation:** a versioned, reviewable rule process that selects or combines competing observations into a canonical fact while preserving alternatives/disputes. It is not independent verification.
- **Estimate:** a source-reported or Civica-derived quantity that is not a direct observation and depends on a declared method, assumptions, or incomplete inputs. It must retain method/vintage/uncertainty status.
- **Indicator:** a defined measurable variable used as an input or descriptor. It does not by itself constitute an overall governance verdict.
- **Index:** a composite produced by transforming and aggregating multiple indicators under declared rules and weights. It is method-dependent, not objective truth; Civica's current Index is research Beta.
- **Signal:** a provisional pattern, flag, or model/rule output that may warrant attention. It is not automatically a fact or validated measurement; current Pulse dimensional effects are experimental heuristics.
- **Event:** a bounded real-world occurrence represented in the Pulse ledger from one or more records. The ledger entry can include inferred clustering/classification and must expose source/review state.
- **Confidence:** the stated strength of evidence, model agreement, or review outcome under a named procedure. It is not automatically a calibrated probability or statistical confidence interval.
- **Uncertainty:** documented limits, ranges, missingness, disagreement, or sensitivity arising from inputs and method. A sensitivity range is not a confidence interval unless a justified statistical model makes it one.
- **Validation:** evaluation against a declared test, benchmark, dataset, or human standard. Software/schema checks validate implementation behavior; they do not by themselves scientifically validate an Index or signal.
- **Replication:** an independent rerun using released inputs, code, environment, and instructions that reproduces declared outputs within stated tolerances. A planned/package-status page is not completed replication.
- **Peer review:** substantive evaluation by qualified independent experts under a disclosed process. Informal feedback, automated review, advisory-board applications, or internal agent critique are not peer review.

## Narrow prohibited-usage policy

Scan only registered canonical research/methodology surfaces, not blogs or ordinary UI prose. Rules must be sentence/context aware and permit explicit negation, future gates, external publication titles/citations, and implementation-level validation.

- Reject affirmative claims that a Civica methodology, Index, Pulse, score, signal, or measure is `validated`, `scientifically validated`, `academically validated`, or `independently validated` before its research gate. Allow `not validated`, `has not been validated`, `pending validation`, `validation plan/test/gate`, and schema/input/software validation.
- Reject affirmative `peer-reviewed` / `peer reviewed` / `has undergone peer review` claims about Civica outputs. Allow explicit `not peer-reviewed`, future plans, and descriptions of external literature.
- Any Civica sensitivity/simulation range described as a `confidence interval` must be explicitly negated or distinguished from one in the same sentence/context. Preserve current `not a confidence interval` language.
- Reject affirmative claims that Civica's Index/Pulse/method has been independently replicated or that a replication package is published/available while the canonical replication state is unpublished. Allow external dataset `replication archive` citations, future plans, and explicit non-availability.
- Do not blanket-ban ordinary occurrences of source, fact, event, signal, indicator, estimate, confidence, validation, replication, or peer; false-positive resistance is part of acceptance.

## Likely owned files

- new `src/lib/research-terminology.ts`
- new focused tests under `src/lib/`
- `src/lib/data/glossary.ts`
- `src/lib/docs/doc-concepts.ts` and directly affected test
- new `scripts/validate-research-terminology.ts`
- `package.json`
- only if a real current violation is found: the smallest canonical methodology markdown/TSX correction

Run focused tests, `npm run validate:terminology`, `npm run validate:doc-sources`, `npm run validate:content-templates`, `npm run typecheck`, and targeted ESLint. Return the standard worker-result envelope with exact changed files, commands, results, and blockers.
