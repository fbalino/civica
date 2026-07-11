# DAT-017 — Versioned Atlas bulk export

## Outcome

DAT-017 is complete. Release `atlas-2026-07-11` is downloadable as a
gzip-compressed `civica-atlas-export/v3` JSON package from the API documentation.

The release contains three machine-readable tables:

- 253 stable jurisdiction identity and status records;
- 12,373 canonical fact rows from the immutable Q1 vintage;
- three complete source-rights records: CIA Factbook, Wikidata, and World Bank.

Every emitted field is documented in the embedded codebook. Fact rows retain
stable IDs, source and jurisdiction joins, URLs, frozen values and units,
vintage label, cutoff, content hash, published methodology version, and the
selected source-observation ID.
Ordering is deterministic. The generated and release dates are fixed to the
named release.

## Rights boundary

The rights manifest registers both the export product and frozen artifact as
publicly distributable. Index, Pulse, sources without verified bulk-export
terms, images, constitution text, and raw publisher payloads are excluded. The
old per-country JSON/CSV route remains blocked until DAT-027.

## Verification

- Uncompressed semantic SHA-256:
  `60556198b2ee3805f93558db47b1e5620c4f8f5cf372d6f83ebb6265fdcfa9fc`.
- The release manifest also records compressed hash, compressed/uncompressed
  sizes, row counts, release date, schema version, and download path.
- `npm run validate:atlas-export:live` rebuilt the package from Neon and matched
  the checked bytes exactly.
- Focused fixtures prove deterministic ordering, fail-closed pending-source
  handling, observed-zero preservation, and post-cut value isolation.
- 617/617 repository tests passed.
- The aggregate claims/docs gate and production build passed.
- The API documentation rendered the release ID, exclusions, hash, codebook
  notice, and download link with zero browser console errors or warnings.
- The download returned HTTP 200, `application/gzip`, an attachment filename,
  immutable caching, and passed `gzip -t`.
