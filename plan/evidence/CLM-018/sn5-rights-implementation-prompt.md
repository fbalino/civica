# SN5 CLM-018 bounded implementation

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Sonnet 5, subscription-first, single writer for CLM-018. Read `AGENTS.md` and the CLM-018 plan row first. Do not commit, browse the web, access the database, or redesign UI. Use existing editorial primitives/classes only; no CSS is expected.

Binding decision:

- CLM-018 closes with an explicitly **interim current-rights registry**, not a complete source/field/product/release manifest.
- DAT-003 still owns the complete machine-readable release rights manifest.
- There is no root `LICENSE`; do not choose one. Correct every open-source/MIT/repository-license claim to the current truth: source is publicly viewable, but no open-source reuse license is presently granted. BRD-007/008 own the later license decision.
- Free/no-account access is not permission to reuse data. Downloads and citations are not licenses. Source-dependent reuse follows the upstream terms attached to the data. Hosted widget embedding may be permitted while underlying data reuse still varies.

Implement this bounded architecture:

1. Add a typed module such as `src/lib/claims/reuse-rights.ts` containing:
   - one canonical path/URL under `/licensing`;
   - exact access-vs-reuse boundary copy;
   - `CODE_RIGHTS` with `hasLicenseFile: false`;
   - `RELEASE_MANIFEST_STATUS` with `available: false`, owner `DAT-003`;
   - an explicitly interim, incomplete artifact-class registry for source data, Civica-derived outputs, downloads/API, hosted embeds, code, editorial imagery, and frozen releases. Each row must say its scope, current permission posture, governing basis, and reader action. It must be impossible to mistake this for DAT-003's complete source/field/release manifest.
   - a required-surface registry covering footer, about, licensing, terms, metadata, downloads, API docs, embeds, citation UI, and `CITATION.cff`.
   - pure invariant/scanner helpers for tests and the validator.
2. Make `/licensing` render its current rights table from that typed registry and visibly disclose that no complete frozen-release rights manifest is published. Preserve the existing imagery policy unchanged. Do not claim live DB rows form a complete manifest.
3. Repair every public contradiction, including:
   - footer headline/lead;
   - `content/about.md` heading/paragraph (preserve stable anchor compatibility if practical);
   - Terms opening language;
   - `README.template.md`, regenerated `README.md`;
   - `content/blog/welcome-to-civica.mdx` metadata, tags/headings, and the false “all data” paragraph;
   - `CITATION.cff` comment and `open data` keyword;
   - licensing code row/prose.
4. Close point-of-use gaps:
   - CiteAccordion: restrained existing-class line/link saying citation/download is not a reuse license and source terms vary;
   - embed route: all sizes must carry a rights pointer (machine-readable metadata is acceptable for the small size; medium/large/custom should make the pointer legible without nested links); the widget gallery should state hosted embedding permission vs underlying-data reuse;
   - API docs/download section: downloading/exporting does not create one dataset license; link the canonical rights registry.
5. Metadata:
   - keep `Dataset.isAccessibleForFree: true` because it means no-charge access, not reuse permission;
   - add a nonempty `conditionsOfAccess` statement explicitly separating access from reuse;
   - source the Dataset license URL from the canonical rights constant;
   - extend metadata-contract validation/tests so missing or misleading access conditions fail.
6. Claims/gate:
   - update/register exact public reuse/code/release-status claims in the existing public-claims registry as appropriate;
   - add `scripts/validate-rights-claims.ts` and a package script;
   - the validator must scan the actual required surfaces, fail on missing/silent rights pointers, blanket data-open/free-to-use claims, code open-source/MIT claims while no LICENSE exists, and false complete-release-manifest language;
   - add focused negative and false-positive fixtures for every rule class;
   - register this validator as a child of `validate:claims-docs` without recursion.
7. Add concise rights discipline to `AGENTS.md`. Update README through the existing generator, never by hand only.

Avoid these traps:

- Do not add a root LICENSE or select legal terms.
- Do not create a public artifact named as a complete rights manifest.
- Do not assert that every API/CSV field already has machine-readable rights lineage.
- Do not treat `sources.license` plus `isCommercialUseAllowed` as a release-specific permission grant.
- Do not add migration-history prose.
- Preserve stable About anchors and existing policy/imagery behavior.

Acceptance before returning:

- focused rights tests and metadata tests pass;
- new rights validator, `validate:public-claims`, `validate:metadata`, `validate:content-templates`, and `validate:claims-docs` pass;
- typecheck, targeted ESLint, README/doc-reference validation, and `git diff --check` pass;
- report changed files and any incomplete item. Do not edit plan checklists/progress/decisions/orchestrator state/evidence beyond this result and do not commit.
