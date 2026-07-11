# Pulse evidence API-contract release note

Date: 2026-07-11
Task: PUL-005
Change-control version: `civica-index-api-contract-pulse-evidence-v1`

The shared API schema and example registries now include the safe Pulse
evidence identity returned by event and changelog endpoints. The response adds
the exact source URL, retrieval time, content and identity hashes, language
state, publisher/source family, ingest-time attribution evidence, rights
posture, and private-retention policy. It does not return stored publisher
payloads.

This is a presentation-contract change only. It does not alter any Civica
Index input, transform, weight, missing-data rule, uncertainty treatment,
score, rank, disposition, or Governance Evidence observation.
