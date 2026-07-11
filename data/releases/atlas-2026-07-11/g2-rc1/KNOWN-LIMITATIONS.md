# Known limitations

- The package reproduces the normalized frozen Atlas export from its released observation rows; it does not replay publisher ingestion from unretained upstream bytes.
- The release contains source observations, not one reconciled canonical value per fact key.
- Only CIA Factbook, Wikidata, and World Bank rows whose public bulk-export posture was verified are included.
- Country images, constitution text, Index scores, Pulse records, restricted sources, statements, disputes, and raw publisher payloads are excluded.
- The clean-room result verifies deterministic export construction and package integrity; it is not an independent substantive validation of publisher accuracy.
- DOI registration and external repository acceptance remain later governance work.
