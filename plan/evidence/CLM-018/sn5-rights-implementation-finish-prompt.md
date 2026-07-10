# SN5 CLM-018 finish the existing partial implementation

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Sonnet 5, subscription-first, bounded single writer. The previous worker was stopped after writing only:

- new `src/lib/claims/reuse-rights.ts`
- partial `src/lib/seo/jsonld.ts`
- partial `src/lib/seo/metadata-contract.ts`

Do not restart architecture research. Inspect and finish that partial implementation now. Do not commit, browse, access DB, edit plan ledgers, or add CSS.

Required corrections to the partial module before use:

- canonical pointer should be a stable `/licensing` section anchor;
- never imply public-domain/CC0 attribution is legally required; say the exact upstream designation governs;
- do not generalize that “most index feeds” are non-commercial;
- do not imply CSV/API always carry per-row license fields if they do not;
- derived outputs currently have no standalone dataset license grant; citation is credit, not permission;
- scanners must be negation-aware so honest “no complete manifest exists” copy passes;
- the interim registry must visibly say it is incomplete and not DAT-003.

Finish mechanically:

1. Complete Dataset `conditionsOfAccess` validation and negative/positive metadata tests; source the Dataset license URL from the rights constant.
2. Make `/licensing` render the typed artifact-class registry, honest code status, and unavailable release-manifest status while preserving imagery prose.
3. Update footer, About, Terms, API docs/downloads, widget gallery, all embed sizes (machine-readable pointer for small; legible rights text where space permits), CiteAccordion, CITATION.cff, README template/generated, `content/blog/welcome-to-civica.mdx`, AGENTS, and the exact public claim registry entries. Remove every false open-source/MIT/repository-license/all-data-open statement.
4. Add pure rights tests plus DB-free `scripts/validate-rights-claims.ts`. It must validate registry invariants, missing/silent required surfaces, blanket data claims, code-license overclaims when no root LICENSE exists, false affirmative complete-manifest claims, and required public-claim linkage. Include false-positive guards for explicit negation and source-scoped discussion.
5. Add `validate:rights-claims` to package scripts and as one child of `validate:claims-docs` (existing category is fine). No recursive build wiring.
6. Regenerate README from its template.

Run focused rights + metadata tests, new validator, public claims, metadata, content templates, full claims-docs gate, typecheck, targeted ESLint, doc references, and diff check. If a check is slow, prioritize correctness and report it rather than planning further.

Return the standard worker JSON with all changed files and checks. No commit.
