# Subscription-runtime implementation wave — 2026-08-17

Implements the adopted owner resolution
(`plan/pulse-subscription-runtime-resolution-v1.md`) end to end in code,
method, and protocol. Companion records: `ingest-restoration-2026-08-17.md`
(same wave, earlier same day) and the fresh dated coverage audit
`source-coverage-audit-2026-08-17.json`.

## Live $0 enforcement (deployed ahead of the wave)

- A controlled invocation of the scheduled classify route proved the paid
  path still spent while provider keys remained in the production
  environment (bounded burst, tens of cheap-model calls, recorded in
  `pulse_classification_attempts`).
- Hotfix PR #21 (merged 2026-08-17) hard-locks the scheduled route: without
  `PULSE_CLASSIFY_TRANSPORT=subscription-cli` — never set on Vercel — it
  returns an honest 503 `paid_transport_locked` skip before touching
  providers, keys, or the queue.
- The owner independently removed `DEEPSEEK_API_KEY`, `GLM_API_KEY`, and
  `ANTHROPIC_API_KEY_PULSE_CLASSIFIER` from the production environment and
  redeployed; live probes then returned the clean `provider_key_absent`
  skip. Two independent locks now cover the route.

## Subscription voter transport (pulse-v2.16-beta)

- `src/lib/pulse/v2/subscription-cli.ts`: headless CLI transport for the
  owner-approved panel — Codex → `gpt-5.6-terra`, Claude Code →
  `claude-sonnet-5`, Kimi CLI → `kimi-k3` (CLI alias `kimi-code/k3`),
  Grok CLI → `grok-4.5`. Read-only sandbox for Codex, strict empty-output
  and nonzero-exit rejection, per-call timeout, scratch working directory,
  CLI-reported model capture. All four voters passed live parallel smoke
  tests on this Mac at $0 marginal cost.
- `provider.ts` / `model-operations/contract.ts`: `xai` and `moonshot`
  providers exist only on the subscription transport (no HTTP path, no
  key); the subscription panel is a closed set immune to env drift; the
  approved-model registry records the owner's 2026-08-17 model authority.
- `classify.ts` / `country-attribution.ts`: voter, verify, and
  subject-attribution runs carry transport identity; configuration identity
  (APR-D147) includes the transport and the honest
  `provider-default-json` decode mode; PUL-036 is strengthened in code —
  subscription-transport classifications can never auto-publish.

## Method and protocol

- Runtime method `pulse-v2.16-beta`, contract schema 1.15.0, regenerated
  (`snapshot:pulse-runtime`; 901-check validator passes). Retained
  v2.15 score runs remain verifiable as named history
  (`publication-consistency.ts` retained-method registry).
- `pulse-validation-protocol/v2` supersedes v1 pre-start (IDX-038
  precedent): freezes the subscription configuration, carries non-backdating
  and retention rules unchanged, and predeclares the within-window
  provider-side model-change segmentation policy. The v1 artifact is
  preserved byte-for-byte and pinned by hash in tests;
  `validate:pulse-validation-protocol` passes.

## Operations

- `scripts/pulse/mac-daily-runner.sh` + `install-pulse-runner.command`:
  launchd daily cycle at 09:30 local with wake catch-up; ingest/cluster/score
  through the idempotent production cron routes, classification locally on
  the subscription CLIs; per-day idempotency keys; owner notifications on
  failure. No paid transport anywhere.
- Drift monitoring (PUL-024 machinery) already passes its validator; its
  checklist state waits, per its own completion boundary, for a versioned
  baseline over frozen-method observations plus one scheduled monitoring
  outcome — both scheduled for the post-deploy first compliant cycle.

## Verification at this cut

- 302/302 pulse unit/fixture tests, TypeScript clean,
  `validate:pulse-runtime`, `validate:pulse-source-coverage`,
  `validate:pulse-validation-protocol`, `validate:pulse-drift`,
  `validate:cron-safety` all pass locally.
- PUL-040's start remains unrecorded: the first compliant cycle must run
  under the deployed v2.16 method before any window day counts. Never
  backdated.
