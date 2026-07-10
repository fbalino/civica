# OP48 CLM-018 final acceptance review

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Opus 4.8, subscription-first, independent read-only reviewer. Do not edit files, commit, browse, or use the database. You may run read-only repository commands and the DB-free validators/tests needed to assess the implementation. Let all analysis complete before returning.

Review the current uncommitted CLM-018 implementation against this acceptance contract:

> Footer, about, licensing, terms, metadata, downloads, API docs, embeds, and citation surfaces distinguish free access from reuse rights; every reuse claim resolves to the canonical rights registry; no global surface calls all data open.

Binding decisions already adjudicated:

- CLM-018 closes with an explicitly interim, artifact-class current-rights registry. It must not masquerade as DAT-003's future complete source/field/product/release manifest.
- Free, no-account access is distinct from permission to redistribute, republish, or derive.
- Upstream source rights remain source-dependent.
- There is no root `LICENSE`; code may be described as publicly/source viewable but not open source or MIT-licensed. BRD-007/008 own the future code-license decision.
- Frozen-release rights manifests do not yet exist; DAT-003 owns them.
- Hosted embed permission does not grant rights in underlying data.
- Citation is not a reuse license.
- `isAccessibleForFree: true` in Dataset JSON-LD is valid only alongside explicit `conditionsOfAccess` and the canonical rights URL.
- Required rights language must be fail-closed through the claims/documentation gate and adversarial fixtures.

Inspect at minimum:

- `src/lib/claims/reuse-rights.ts`
- `scripts/validate-rights-claims.ts`
- `src/lib/claims/__tests__/reuse-rights.test.ts`
- `src/lib/ci/claims-docs-gate.ts`
- all modified public surfaces shown by `git diff`
- `CITATION.cff`, `README.template.md`, generated `README.md`, and the launch blog
- metadata contract and tests
- browser evidence in `plan/evidence/CLM-018/`

Pay special attention to semantic contradictions, scanner bypasses/false positives, silent required surfaces, false complete-manifest implications, code-license overclaims, and whether the medium embed's reuse pointer is genuinely visible in the 320×180 frame.

Return a concise JSON object with:

- `verdict`: `ACCEPT`, `ACCEPT_WITH_NONBLOCKING_NOTES`, or `REJECT`
- `blocking_findings`: exact file/line/evidence and required correction
- `nonblocking_notes`
- `acceptance_checks`: one result per binding decision and named surface
- `validator_assessment`
- `evidence_assessment`
- `recommended_next_action`

Do not reject for DAT-003/BRD-007/BRD-008 work that is explicitly and honestly deferred. Reject any remaining false blanket-open or code-license claim, a required surface without a canonical rights pointer/boundary, a validator that can pass seeded contradictions, or an embed notice that is clipped.
