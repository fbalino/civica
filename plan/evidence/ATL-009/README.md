# ATL-009 — constitutional search corpus audit

This directory freezes the pre-implementation evidence boundary for ATL-009.
It does **not** claim that cross-corpus search exists. The live audit on
2026-07-12 found a usable English full-text corpus, but also found provenance,
rights, translation-context, versioning, and search-index gaps that must be
closed before the research feature can pass.

## Checked live baseline

- 186 constitution documents covering 186 jurisdictions.
- 183 of 194 sovereign states (94.3%), plus Kosovo, Palestine, and Taiwan.
- 96,127 structured sections and 30,537 topic excerpts across 329 topic keys.
- No empty constitution document, duplicate document text, duplicate section
  identifier within a document, generated-anchor collision, orphan excerpt
  reference, or duplicate excerpt natural key was found.
- The importer explicitly requests English (`lang=en`), but the stored rows do
  not record content language, source language, translation status, translator,
  or an HTML `lang` marker. The only supportable disclosure is therefore
  **publisher-supplied English; original-versus-translation status unknown**.
- Only 20 of 186 documents (10.8%) have statement-level provenance. All 20
  lack a source hash, and the Bangladesh and Nigeria statement URLs point to
  older Constitute document identifiers than the current rows.
- Constitute rights remain pending in the machine-readable rights manifest.
  Search results must not turn the current reader's unverified license wording
  into a verified rights claim or public bulk export permission.
- The live schema has no passage search table or full-text index. ATL-009 is
  therefore explicitly `not_applied` at this checkpoint.

The complete machine-readable baseline is in
[`corpus-audit.json`](corpus-audit.json). The future implementation gates and
fixtures are in [`acceptance-contract.md`](acceptance-contract.md).

## Read-only validation

With `DATABASE_URL` available in `.env.local`, run:

```text
npx tsx scripts/validate-constitution-search-corpus.ts
```

The validator issues only `SELECT` queries. It checks the frozen corpus counts,
coverage, structure and anchor integrity, language boundary, provenance gaps,
current indexes, and whether a future passage-search relation has appeared. A
missing passage-search relation is reported as `not_applied`, not passed off as
a completed feature.

## Scope

This checkpoint deliberately does not edit the database schema, migrations,
queries, API, reader UI, source-rights registry, or public methodology. Those
changes belong to the implementation and review stages of ATL-009.
