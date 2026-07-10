# OP48 CLM-018 rights-contract adjudication

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Opus 4.8, subscription-first, read-only decision reviewer. Do not edit files, commit, browse, or use the database.

Adjudicate the smallest honest implementation contract for:

> CLM-018 — footer, about, licensing, terms, metadata, downloads, API docs, embeds, and citation surfaces must distinguish free access from reuse rights; every reuse claim resolves to the source/release rights manifest; no global surface calls all data open.

Important repository evidence:

- `sources` has `license` and `isCommercialUseAllowed`; `scripts/seed-sources.ts` seeds mixed values.
- There is no complete source/field/product/release rights manifest; DAT-003 owns that future artifact.
- `/licensing` is a hand-authored summary, not generated from live source rows.
- There is no root `LICENSE` file, yet `README.template.md`, generated `README.md`, `content/about.md`, the licensing code row, and a public blog description call the code open-source, repository-licensed, or MIT-licensed.
- Footer/About lead with “Open” framing; terms/API docs mostly distinguish access/reuse; citation and embeds are silent at point of use.
- CITATION.cff correctly omits a license key but still has an `open data` keyword and says code is governed by repository notices.
- Dataset JSON-LD uses `isAccessibleForFree: true` and points `license` to `/licensing`.

Decide:

1. Whether CLM-018 can close before DAT-003 and exactly what interim typed registry/manifest is honest enough.
2. The canonical public wording for free access vs source-dependent reuse, no frozen release manifest, source-visible but currently unlicensed code, hosted embed permission, citations not being licenses, and derived outputs.
3. Minimum required changes across every named surface plus README/blog false code-license claims.
4. A fail-closed validator/fixture contract that catches blanket data claims, code-license overclaims, silent required surfaces, and false claims that a release rights manifest exists.
5. What must explicitly remain deferred to DAT-003/BRD-007/BRD-008.

Return concise JSON with `verdict`, `binding_contract`, `surface_requirements`, `validator_requirements`, `deferred_scope`, `blocking_findings`, and `acceptance_tests`. Reject any approach that creates a partial artifact readers could mistake for DAT-003's complete release manifest.
