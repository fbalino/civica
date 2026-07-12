# PUL-034 — scalar Pulse v1 retirement

Pulse v2 publishes an experimental event ledger and named per-dimension
deltas. It has no scalar country score or ranking. PUL-034 makes that boundary
terminal across code, storage, routes, caches, and documentation.

The retired `sort=cp` parameter now returns a case-insensitive `410 Gone`
contract before any database read. Unknown sort values remain `400`. Legacy
embeds return an uncached retirement notice, and the API documentation no
longer advertises a live score widget. The dimensional country endpoint is the
machine-readable successor; it is not converted into a scalar or ranking.

All three authenticated Pulse v1 cron routes retain their authorization
boundary and then return a stable `410` with the matching v2 stage. Their CLI
entry points fail before loading a database or model client. The executable
scalar calculator and its npm alias are gone.

Production contained zero rows in both scalar-output relations and 462 rows in
the separate legacy event table. Migration `0026_magenta_xavin` therefore
drops only the two empty output relations. It aborts if either contains a row
and does not alter `pulse_events`. The checked static/live validator prevents a
reader, writer, route, command, cache promise, schema export, or current data
dictionary entry from reviving the retired representation.

See `migration-plan.md` for the forward and recovery procedure and
`verification.md` for the completed gates.
