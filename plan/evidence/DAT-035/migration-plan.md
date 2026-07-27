# DAT-035 metadata update plan

1. Rebuild the source-input manifest from its already checked four captures.
2. Rebuild the raw-retention manifest from that checked metadata.
3. Run the fail-closed source-input, retention, release-selection, and
   change-control validators.

This is not a database migration. It writes no database rows and has no
rollback beyond an append-only correction record if a later review finds the
classification wrong.
