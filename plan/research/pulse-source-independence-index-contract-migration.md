# Pulse source-independence shared-contract migration

Clients reading the Pulse methodology endpoint may consume the new additive `corroboration` object. Strict clients that mirror the old top-level schema must allow this field. Clients should use `countingUnit` and `sourceIndependence.version` rather than interpreting connector IDs or URL counts as independent sources.

Clients do not need to rewrite historical event rows. Current confidence and dimension rows point to the new versioned corroboration run. Older stage identities remain available through lineage metadata and must not be relabelled as if the v1 independence detector produced them.

No country score, grade, rank, or source-native Governance Evidence Dashboard field changes in this migration.
