# DAT-027 — Canonical-plus-alternates country exports

Completed 2026-07-11.

## Outcome

`/api/countries/{slug}/export?format=json|csv` now publishes the current
resolver output as `country-research-export/v1`. Each exported fact has exactly
one canonical observation. Other evidence is divided into measured alternates,
projections, and rejected or otherwise inactive rows. Every observation carries
its value state, source URL and license, source and observation dates, upstream
vintage, value type, lifecycle status, method versions, selection trace, and
open-dispute state.

The selection algorithm remains `source-precedence/v1`; the exporter does not
run a second ranking method. Source rights are applied after resolution. Rows
without verified public-export permission are omitted. When the resolver's
canonical source is restricted, the whole fact is listed as withheld instead of
promoting a distributable alternate and calling it canonical.

JSON and CSV are produced from the same document. CSV repeats document-level
rights and withholding metadata and uses `record_class` to preserve the four
observation classes.

## France proof

The deterministic France population fixture contains:

- one World Bank canonical measurement;
- one Wikidata alternate measurement;
- one CIA projection;
- one rejected World Bank value;
- one restricted row that cannot appear in either format.

JSON and parsed CSV preserve the same row ID, class, numeric value, source, and
lifecycle status for every distributable observation. A separate fixture makes
the restricted source canonical and proves the fact is withheld rather than
reassigned.

## Live verification

- France JSON: HTTP 200, 46 exported fact keys, 46 canonical observations and
  seven alternate observations.
- France CSV: HTTP 200 and the same 53 observation rows as JSON.
- All live rows come from the three currently permitted source IDs: CIA
  Factbook, Wikidata, and World Bank.
- All 53 rows contain the required source, rights, freshness, method, decision,
  and dispute fields.
- 36 France fact keys, including `population_total`, are honestly listed as
  withheld because their selected canonical source does not yet have verified
  public-export terms. No fallback source is relabelled canonical.
- Invalid format returns 400; unknown country returns 404.
- `/api-docs#country-export` renders the current contract in the browser with no
  console or request errors.

Machine-readable live result: `live-france-export-audit.json`.

## Gates

- France export fixtures: 3/3 pass.
- Repository tests: 636/636 pass.
- Rights manifest, API contract/docs, public claims, data-value state, G2
  package, TypeScript, and all production-build gates pass.
- G2 was repacked with the current rights manifest: 1,869,046 bytes, SHA-256
  `65c8245c31a3eae7211b3b9f5421d59c759b77ac47b58804fd89c867d60dc656`.
