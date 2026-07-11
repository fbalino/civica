# Pulse decision-ledger shared-contract v7 release note

**Contract version:** `civica-index-api-contract-pulse-decision-ledger-v7`

The Pulse runtime-method response now declares `decisionLedger`. It names the seven decision kinds, append-only storage, the event row's role as a current projection, the four verifier axes, same-axis supersession, and the prohibition on a generic confidence field.

The runtime method is `pulse-v2.7-beta`. Corroboration remains a heuristic scoring weight rather than a calibrated probability. Index calculations and country scores are unchanged by this contract revision.
