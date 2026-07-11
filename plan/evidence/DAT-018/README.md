# DAT-018 — Release checksums and bill of materials

## Outcome

DAT-018 is complete. The Atlas release manifest now follows
`civica-release-bom/v1` and is downloadable beside the data package.

It records:

- normalized export SHA-256 and uncompressed byte size;
- gzip file SHA-256 and byte size;
- jurisdiction, fact, and source row counts;
- export, rights, jurisdiction-status, and data-value-state schema versions;
- the full source commit used to generate the export;
- Node, Next.js, Drizzle ORM, TypeScript, and tsx versions;
- per-source row counts, upstream vintage labels, observation-year bounds,
  retrieval cuts, and semantic row hashes.

## Verification

- `npm run validate:release-bom:live` rebuilt the normalized export and BOM
  from Neon and matched the checked artifacts exactly.
- Four focused fixtures prove stable export ordering, blocked-source failure,
  observed-zero preservation, and deterministic BOM construction.
- 618/618 repository tests passed.
- The aggregate claims/documentation gate and production build passed.
- The API documentation rendered the BOM link and tool-version description
  with no console errors or warnings.
- The manifest route returned HTTP 200, JSON content type, immutable caching,
  and an attachment filename; its parsed contents include all required fields.
