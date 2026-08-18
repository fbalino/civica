# PUL-040 runner follow-ups — Index change-control record (2026-08-17)

This record authenticates the operational follow-ups merged in PR #23
(`fix(pulse): runner follow-ups from the first supervised cycles`,
commit `669c7518`) for the `pulse-v2.16-beta` subscription runtime.

## Protected-file change

- `src/lib/pulse/v2/classify.ts` (category `weight_or_model`): voter
  failures log provider/model identity and both CLI output streams, so a
  failing subscription CLI names itself instead of reporting a generic
  `provider_call_failed`. Classification semantics — voters, prompts,
  ontology, agreement, publication gating — are unchanged; the change is
  diagnostic logging at the provider boundary.

## Related non-protected changes in the same merge

- `src/lib/pulse/v2/cluster.ts`: the no-embedding (lexical fallback) path
  finalizes its pipeline run row as terminal `partial` while publishing
  nothing; the serverless route defers real clustering to the owner-Mac
  runner, which executes with embeddings under its own delivery identity.
- `scripts/pulse/mac-daily-runner.sh`, `install-pulse-runner.command`:
  runner query/batch/launchd environment adjustments.

## Test authentication

- `src/lib/pulse/v2/cluster-cron-retry.test.ts` locks the terminal
  lexical-fallback contract: a `partial` run cannot be resumed under the
  same delivery identity, and a fresh identity retains the
  deterministic-retry guarantee after a publish failure.

## Scope

No scoring weights, model assignments, prompts, thresholds, or public
methodology semantics change under this record. Validations follow the
`weight_or_model` category set.
