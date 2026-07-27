# ATL-021 — Research query and download access plan

**Status:** active
**Task:** rights-aware, research-friendly selection and download of the frozen
Atlas release.

## Confirmed starting point

DAT-017/DAT-024 already publish the complete
`civica-atlas-export/v3` gzip package for `atlas-2026-07-11`. The package has
stable IDs, deterministic ordering, a codebook, source-rights rows, a bill of
materials, and explicit exclusions. Per-country and indicator-history exports
also enforce source-specific rights.

What is missing is a bounded query surface over that frozen package. A
researcher currently has to download and decompress the entire release or use
live per-country endpoints. There is no release-bound field selection,
cross-country fact filtering, stable pagination contract, CSV projection, or
machine-readable explanation of fields and corpora withheld from the query
surface.

## Delivery contract

Add `GET /api/v1/atlas/query` over the checked
`atlas-2026-07-11` artifact. The route must:

1. query only the frozen export's `jurisdictions`, `facts`, and `sources`
   tables—never live mutable rows;
2. accept a closed table name, allowlisted field projection, bounded filters,
   JSON/CSV format, and stable offset pagination;
3. preserve the export's deterministic row ordering before pagination;
4. attach release, schema, codebook, source-rights, download, pagination, and
   exclusion metadata to JSON responses;
5. reject unknown fields and parameters before reading the artifact;
6. rate-limit requests through the shared durable public-export policy;
7. fail closed with a content-free unavailable response if the checked
   artifact cannot be loaded or validated; and
8. expose CORS consistently with the public `/api/v1/*` contract.

## Rights and exclusion boundary

The route may return only columns already present in
`civica-atlas-export/v3`. The response must name, with reasons, the excluded
corpora: Civica Index, Pulse, alternate/rejected observations, restricted
sources, images, constitution text, and raw publisher payloads. Field
selection cannot bypass the source-rights rows embedded in the frozen release.

## Examples and ATL-023 dependency

The API documentation will publish copy-paste curl, JavaScript, and Python
queries plus a machine-readable recipe registry. ATL-021 remains open until
ATL-023's three frozen case studies run through those exact recipes and a
validator proves their checked outputs match. This avoids calling an
illustrative snippet a reproduced case study.

## Design register

- **Layout row:** the existing `/api-docs` methodology layout.
- **Hero treatment:** none; no new page or hero.
- **Component register:** existing `EndpointSection`, `CodeBlock`, `Banner`,
  and editorial section classes.
- **CSS/tokens:** no new styling is planned.

## Verification

- Unit fixtures for filtering, projection, pagination, CSV parity, exclusions,
  invalid fields, and corrupt/missing artifact behavior.
- API contract/schema/example, route-inventory, route-I/O, cache, rate-limit,
  claims/docs, and TypeScript gates.
- Real-route browser/API checks on `/api-docs` and
  `/api/v1/atlas/query`, including success, empty, invalid, next-page, CSV, and
  unavailable states.
- Evidence under `plan/evidence/ATL-021/`.
