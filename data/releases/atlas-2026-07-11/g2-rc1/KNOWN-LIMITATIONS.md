# Known limitations

- The package reproduces the immutable Civica snapshot; it does not replay publisher ingestion from unretained upstream bytes.
- Alternate observations are excluded pending the canonical-plus-alternates export owned by DAT-027.
- Only canonical CIA Factbook, Wikidata, and World Bank rows whose public bulk-export posture was verified are included.
- Metadata not copied into the vintage row remains joined from the selected source-observation row; DAT-025 owns the complete temporal-field separation.
- Country images, constitution text, Index scores, Pulse records, restricted sources, statements, and raw publisher payloads are excluded.
- The clean-room result verifies deterministic export construction and package integrity; it is not an independent substantive validation of publisher accuracy.
- DOI registration and external repository acceptance remain later governance work.
