# DAT-030 evidence — atomic Index ingestion

## Contract

The full Index refresh stages five required adapter outputs in exclusive temporary files. It rejects a missing or duplicate adapter, mixed dataset years/quarters/methodologies, source-specific coverage below the registered floor, empty or duplicate jurisdiction rows, overlapping dimension identities, or row metadata drift. The accepted basket receives one order-independent SHA-256.

One Neon batch transaction removes stale rows only within the staged dimensions, upserts the five ingestion records and all staged scores, stamps all four participating source IDs, and marks the retained run manifest completed. A child failure records failed/not-run outcomes and exits nonzero before the transaction.

## Live proof

- Real dry run: 5/5 adapters, 745 staged rows, checksum `9414401c2bcf097672af28bedcda924ad83ac29da5687d46188a76ea0a008f2c`, zero database writes.
- Seeded failure run `9086f019-3f17-4545-821c-1f9914de4265`: nonzero exit; V-Dem failed; four adapters not run; visible score rows remained 1,142 with MD5 `da5142226dd2e37c4df5a31562de9aac`; score mutations during the failed run: 0.
- Completed run `000c7b15-afc9-4aad-ac47-3e117552f3a8`: 745 rows across all five adapter outputs; terminal checksum matches the dry run; completion time is monotonic; all source freshness timestamps were committed with the scores.
- Visible groups: V-Dem democratic quality 170; WGI democratic fallback 20; WGI rule of law 190; Freedom House 190; Transparency CPI 175.

## Schema and verification

- `ci_ingestion_runs` has closed status and terminal-shape checks, a unique release label, and append-only mutation history through the DAT-016 trigger.
- Authoritative migrations `0003`/`0004` have SHA-256 values `1d9741679ac592fe6ffdeb05e6d711a72b8ecd9520ed80969a2648ff37e15823` and `521113620700811c93b9acaf91c5766e0be302d9e8ecb6e9049e3fd8f11d235e`.
- Fresh and live schema fingerprint: `552dd17c582ebef7a30b001a37a2d46fc84a2bcc07b88824be9aaaded4538b86`; live ledger 5/5; rerun pending 0.
- `npm run validate:ci-atomic-ingestion` and `npm run validate:ci-atomic-ingestion:live` pass.
- 644/644 tests and the full production build pass.
