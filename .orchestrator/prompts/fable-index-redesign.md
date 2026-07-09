# Fable task: Civica Index design-space and validation tournament

Project root: `/Users/fernandobalino/Projects/civica`

## Role

Act as an independent senior political-methodology researcher, measurement designer, and product strategist. Your job is to determine what an original Civica measurement product *could* be if it must add genuine scholarly and reader value rather than merely combine familiar governance datasets.

## Bounded objective

Produce a rigorous, creative design-space analysis for the future of the Civica Index. The project owner has decided that Civica Atlas will primarily be a provenance-first comparative reference to how every country is governed. Original scores are secondary experiments and may be redesigned, demoted, or retired if they cannot earn a defensible claim.

First inspect the current repository implementation, public methodology, live-data architecture, and available analyses independently. Do not read files under `plan/` or either attached resolution until you have formed and recorded your own initial diagnosis in working memory. Then read `/Users/fernandobalino/Downloads/resolution (1).md` and pressure-test both its conclusions and your own.

Explore multiple materially different futures, including the possibility that no single headline composite is justified. Do not assume that the current four-dimensional weighted average is the right target. Seek constructs that exploit Civica's distinctive assets: structured institutions, statement-level provenance, source disagreement, government taxonomy, longitudinal source indicators, constitutions, elections, officeholders, and event records.

For each serious candidate, specify:

- the construct and exact claim it would make;
- why it adds information not already available from V-Dem, WGI, Freedom House, or a simple dashboard;
- unit of analysis, temporal cadence, inputs, transformations, uncertainty, missingness, and versioning;
- foreseeable normative choices and misuse risks;
- falsification and retirement criteria;
- validation design, including baselines, out-of-sample tests, sensitivity tests, and human/expert checks;
- reader-facing presentation that avoids judgmental A-F country grading;
- minimum viable research artifact and what must remain explicitly experimental.

Design a fair validation tournament in which the current Index competes against the strongest alternatives and simple baselines. Recommend a winner only if the evidence could in principle distinguish the candidates; otherwise recommend what evidence must be gathered first. Be candid and creative.

Use current primary methodological sources where useful. Distinguish factual findings, inferences, and proposals. Do not treat model consensus as academic validation.

## File ownership and permissions

You may create or edit exactly one repository artifact:

- `plan/research/fable-index-design-space-2026-07-09.md`

All other repository files are read-only and forbidden. Do not run ingestion, sync, migration, deployment, cron, or any command that changes the database or external state. Do not implement product changes.

## Required artifact

Write a standalone report at the owned path with these sections:

1. Executive recommendation
2. Independent diagnosis of the current Index
3. What distinctive value Civica can measure
4. Candidate designs (at least four materially different options)
5. Validation tournament and decision thresholds
6. Recommended public presentation and language
7. Research, data, and implementation prerequisites
8. Failure modes and explicit retirement rules
9. Atomic master-plan recommendations with objective acceptance tests
10. Sources

The report must be understandable to a non-technical owner while retaining enough specificity for implementation and independent replication.

## Acceptance criteria

- The owned report exists and is substantive.
- It is grounded in actual repository evidence with file references.
- At least four genuinely distinct candidate products are compared against simple baselines.
- The tournament contains measurable pass/fail thresholds and does not guarantee that any candidate wins.
- It addresses uncertainty, missingness, longitudinal validity, redundancy, normative grading, interpretability, and external validation.
- It clearly separates agent-completable work from later human-review work.
- No repository file outside the owned report is changed.

## Expected worker-result envelope

Return the standard structured result with status, summary, artifact path, changed files, commands run, verification, whether user input is needed, and recommended next action. The artifact must contain the full analysis; keep the envelope concise.
