# OP48 CLM-015 — terminology contract

Project root: `/Users/fernandobalino/Projects/civica`

You are the read-only terminology adjudicator. Do not edit files, commit, use web search, or inspect unrelated user artifacts. Use at most 35 tool calls and keep the result concise.

Literal task: create and enforce a research terminology glossary for `source`, `observation`, `fact`, `reconciliation`, `estimate`, `indicator`, `index`, `signal`, `event`, `confidence`, `uncertainty`, `validation`, `replication`, and `peer review`. Done when the glossary is published, registered public docs link or conform to its definitions, and a terminology lint catches prohibited ambiguous usages in methodology content.

Inspect the existing glossary data/page, public methodology markdown and TSX-owned rich blocks, claims tiers, documentation-source registry, Pulse runtime contract, Index method, reconciliation method, replication status, and existing validators/tests. Produce:

1. An exact normative definition and allowed/prohibited usage contract for all 14 terms, calibrated to Civica's current truthful-beta posture.
2. A narrow, deterministic lint scope and rule table that catches materially misleading ambiguous usage without banning ordinary English or creating broad false positives.
3. Required public-doc links/conformance checks and the canonical source-of-truth architecture.
4. Seeded positive/negative fixture requirements.
5. Implementation file map and any genuine blockers.

Do not invent validation, peer review, confidence, replication, or provenance that Civica has not achieved. Distinguish ordinary-language uses from research-claim uses. Return the standard worker-result envelope with the detailed adjudication in `summary`; `changed_files` must be empty.
