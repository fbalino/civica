# DAT-038 — Election-corpus integrity binds evidence, not source sync times

Status: complete on 2026-09-29. Code and checked-artifact change only; nothing
was written to production.

## What failed

`npm run audit:source-coverage:live` stopped before comparing anything
(recorded in `plan/evidence/DAT-037/production-repair-2026-09-29.json`). The
live election-corpus fingerprint was `4f9cf168…`; the checked 2026-07-12 audit
expected `a9d59a25…`.

## What changed in production data

A read-only diagnosis (`diagnosis-2026-09-29.json`) found:

- All 915 election rows, with their results and statements, match the checked
  per-row fingerprints exactly. No row was added, removed, or edited, and the
  research evidence history holds no election, result, or election-statement
  change since the audit.
- Two source rows moved their `last_sync_at` and nothing else:
  - `ipu_parline`, 2026-07-05 to 2026-09-25 08:01:11 UTC. Pulse's daily news
    ingest has an IPU connector that stores recent IPU elections as Pulse raw
    events under this source ID, and its writer stamps freshness for the
    sources it inserted (3, 1, 1, and 2 rows on 17 and 25 August and on 18 and
    25 September).
  - `wikidata`, 2026-07-08 to 2026-08-10 02:55 UTC, by the owner-authorized
    DAT-036 Wikidata publisher refresh.
- Regenerating the whole audit against production with its date held at
  2026-07-12 reproduced the checked file except for those two timestamps and
  the fingerprint built from them.

Both writers followed the freshness contract: they committed rows from that
publisher and stamped the shared publisher row through the sanctioned helper.

## Why the gate was wrong

The corpus fingerprint bound each referenced source's `last_sync_at`. That
column is shared by every pipeline that reads the same publisher, so an
unrelated news ingest or fact refresh broke the election audit. Qualification
never reads it: a source's sync time is only a fallback for an event
statement with no retrieval time, and `statements.retrieved_at` is
`NOT NULL`. Regenerating the audit would only have bound the new timestamps
until the next IPU item in Pulse, roughly weekly.

## What changed

- `electionCorpusIntegrityFingerprint` binds each referenced source's identity
  and license, and ignores any other field it is given (APR-D175).
- The generator and live loader supply identity and license only, and the
  checked audit no longer stores a copy of source sync times.
- The checked audit was re-expressed under the corrected binding by the
  corrected generator with its 2026-07-12 date held fixed. Only the baseline
  fingerprint (`e6085701…`), its rule text, and the three removed timestamps
  differ; every row, disposition, and count is unchanged.
- `validate:election-corpus-audit` now recomputes the checked fingerprint
  from the checked rows and source identities, so the binding is checked
  without a database.
- A regression test fails on the former binding and passes on this one.

## Public surfaces

No public election surface was failing closed. Reader and API surfaces gate
each row on its own content fingerprint, which never included source sync
times, and all 915 matched. Only the two offline live audits read the corpus
fingerprint.

## Verification

See `verification-2026-09-29.json`. Both `audit:election-corpus:live` and
`audit:source-coverage:live` pass read-only against production; the focused
validators, typecheck, lint, and the full unit suite pass.

## Separate finding

The production run ledger records all 98 failed/partial `pulse.v2.ingest`
runs since 2026-08-15 with zero rows written and no freshness sources, even
though partial runs committed raw events and advanced freshness. That is a
run-ledger reporting gap, tracked outside this task.
