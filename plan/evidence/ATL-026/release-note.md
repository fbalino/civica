# ATL-026 release note

`conditions-components/v1` replaces opaque Conditions writes with a
calculation/component ledger. Each component retains its exact native value,
reference year, source lineage, value state, and inclusion decision. The
current economic policy refuses mixed-year inputs and does not persist a score
or synthetic newest-component year for them.

The public reader now admits only aligned scores that join to a decomposable
calculation. Historic opaque Conditions scores remain retained but are not
presented as if they met this contract. This is a schema-and-code release note,
not a claim that the configured database has already been migrated.
