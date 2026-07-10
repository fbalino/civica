# SN5 CLM-015 — terminology inventory

Project root: `/Users/fernandobalino/Projects/civica`

You are a read-only repository analyst. Do not edit files, commit, use web search, or inspect unrelated user artifacts. Use at most 40 tool calls and keep the result concise.

Literal task: create and enforce a research terminology glossary for `source`, `observation`, `fact`, `reconciliation`, `estimate`, `indicator`, `index`, `signal`, `event`, `confidence`, `uncertainty`, `validation`, `replication`, and `peer review`. Done when the glossary is published, registered public docs link or conform to its definitions, and a terminology lint catches prohibited ambiguous usages in methodology content.

Inventory only what is needed to implement this safely:

1. Which of the 14 terms already exist in `src/lib/data/glossary.ts`, their exact ids/definitions/source fields, and what is missing or misleading.
2. Every canonical methodology/document surface that should link or conform, using `src/lib/docs/doc-concepts.ts` and existing registries rather than a repo-wide prose rewrite.
3. Concrete high-risk current usages that violate likely truthful definitions, separated from benign ordinary-language uses.
4. Existing validator/test patterns to reuse and a non-overlapping implementation file map.
5. Any blocker that prevents objective closure.

Return the standard worker-result envelope with the inventory in `summary`; `changed_files` must be empty.
