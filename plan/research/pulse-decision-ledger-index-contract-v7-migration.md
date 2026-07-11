# Pulse decision-ledger shared-contract v7 transition

Clients that validate the Pulse runtime-method response must accept the required `decisionLedger` object and runtime schema `1.6.0`. They should treat `pulse_events_v2` fields as the current projection and use decision rows when reconstructing or auditing a judgment.

A correction supersedes only the named decision kind. Clients must not infer changes to subject, category, severity, corroboration, or publication from a decision on another axis. `confidenceWeight` is confined to corroboration and carries `heuristic_not_probability`; it must not be presented as an event-truth probability.
