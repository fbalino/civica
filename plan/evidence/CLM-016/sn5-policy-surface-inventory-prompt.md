# SN5 CLM-016 policy-surface inventory

Project root: `/Users/fernandobalino/Projects/civica`

Role: bounded read-only repository analyst.

Objective: inventory the exact current implementation relevant to CLM-016 and write a concise evidence report to `plan/evidence/CLM-016/sn5-policy-surface-inventory.md`.

CLM-016:

> Publish correction, retraction, version, and known-limitations policies linked from every research artifact. Done when: policies define severity, response time, historical preservation, API/data corrections, notification, and version increments; a simulated correction produces the expected changelog, supersession marker, and release-note entry.

Inspect only:

- existing public correction/dispute pages, forms, APIs, tables, and admin resolution paths;
- current methodology/version/changelog/known-limitations surfaces;
- `src/lib/docs/doc-concepts.ts`, public-claims/numeric registries, sitemap/footer/navigation, and reader artifact links;
- schema fields capable of representing corrections, retractions, supersession, and versions;
- existing tests/validators/release-note mechanisms that can be reused.

Do not edit application or plan files other than the owned report. Do not run a browser, server, database mutation, or broad test suite. Use no more than 35 tool calls. Do not audit unrelated product areas.

The report must include:

1. Current truthful capabilities vs. missing pieces.
2. A bounded list of public research artifacts that must link to the policy, with source file paths.
3. Existing data/schema/API paths usable for a correction simulation and the minimum safe fixture design (no production DB writes).
4. Contradictions or overclaims that CLM-016 must repair.
5. Recommended owned implementation files and files that should remain untouched.
6. Objective acceptance checks.

Expected worker result envelope: return a normal structured worker result naming the report artifact, files changed (only the report), commands run, verification, and next action.
