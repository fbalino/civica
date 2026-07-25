# Migration plan — author-name diacritic correction

No database, schema, data, or methodology migration is required.

1. Correct mutable source records and their validators to `Fernando Baliño`.
2. Preserve frozen release and reviewer-dossier v1 bytes and checksums.
3. Make future generated drafts and releases consume the corrected canonical
   records.
4. Validate governance, claims, citation, rights, type, design, build, and
   browser behavior before release.
5. Purge normal deployment caches through the ordinary release process; do not
   rewrite historical archives in place.

Rollback is a source revert. A rollback must not be described as changing the
owner's actual name or as restoring preferred metadata.
