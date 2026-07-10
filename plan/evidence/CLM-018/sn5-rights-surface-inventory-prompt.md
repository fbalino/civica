# SN5 CLM-018 rights-language surface inventory

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Sonnet 5, subscription-first, read-only reconnaissance. Do not edit files, commit, browse the web, or use the database.

Task:

> CLM-018 — Replace blanket “all data is open/free to use” claims with exact mixed-rights language. Done when: footer, about, licensing, terms, metadata, downloads, API docs, embeds, and citation surfaces distinguish free access from reuse rights; every reuse claim resolves to the source/release rights manifest; no global surface calls all data open.

Read `AGENTS.md`, the CLM-018 plan row, the current public-claims/doc-source/numeric/terminology/policy validators, and all named public surface implementations. Search broadly for claims such as open data, free to use, public domain, CC licenses, reuse, redistribution, download/export, attribution, commercial/non-commercial, and source licensing.

Return concise JSON with:

- `current_rights_architecture`: existing canonical registries/manifests/helpers and whether a source/release rights manifest truly exists;
- `surface_inventory`: each required surface, exact path/component, current claim, and risk;
- `blanket_claim_hits`: every actionable repository hit, excluding historical plans/evidence unless it can leak publicly;
- `implementation_recommendation`: smallest honest architecture that can satisfy CLM-018 now without pretending DAT-003's full machine-readable rights manifest already exists;
- `tests_and_validator`: adversarial fixtures and one build-gate proposal;
- `blockers_or_dependencies`: especially any part that must defer to DAT-003/G2;
- `files_to_change` and `acceptance_checks`.

Be strict about the difference between free access to Civica's website/API and legal permission to reuse upstream data. Preserve exact current truth; no migration-history prose. Do not propose UI redesign.
