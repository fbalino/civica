# Pulse evidence identity resolution

Date: 2026-07-11

## Resolution

Civica adopts `pulse-raw-evidence/v1` for every Pulse raw item. The
`raw_events` row is the private evidence snapshot. Its source content and
identity fields are append-only and cannot be deleted.

Each snapshot binds the exact item URL, retrieval time, stored publisher
payload and extracted evidence, content hash, language or `und`, publisher,
source family, ingest-time jurisdiction attribution and evidence, and the
source-rights posture captured at retrieval. Each `pulse_sources` row must
point to one snapshot, so every event retains a complete evidence path.

## Rights boundary

Publisher payloads remain private and are never returned by the event or
changelog APIs. Those APIs expose identifiers, hashes, retrieval metadata,
attribution evidence, and the captured rights record. Public payload
redistribution is blocked for every snapshot. Access to an article, feed, API,
or GDELT record does not grant permission to republish underlying content.

## Retained rows

Migration `0015_steep_cyclops` preserves the existing source payloads and
retrieval times, computes hashes, and records the source terms known at the
migration cut. It labels the historical attribution and hash methods as
legacy. It does not infer an original language where none was declared or turn
pending terms into verified permission.

## Deferred work

PUL-007 owns source-family independence and republication detection. PUL-012
owns richer multi-country attribution and separately versioned attribution
decisions. PUL-035 owns append-only numeric output history. This evidence
contract supplies their immutable inputs without claiming those tasks are
complete.
