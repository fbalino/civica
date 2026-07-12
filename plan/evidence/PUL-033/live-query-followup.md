# PUL-033 live-query follow-up

Browser verification exercised the real report query after v16 and found that
PostgreSQL inferred the bound clock in the due-within-24-hours expression as an
interval. The reader page failed safely, but its shared query group discarded
otherwise available event rows and displayed the neutral no-date state.

The query now casts the clock to `timestamp` before interval arithmetic. The
runtime contract records that boundary rule, and the live validator executes
the same report loader and compares its active and legacy counts with an
independent census. A direct live read returns the exact 175-row legacy
quarantine, no active or breached obligation, and available published events.

No schema, migration, SLA target, classification, or live data changed.
