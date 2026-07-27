# Model-operation controls

`civica-model-operations/v1` is Civica's closed contract for every path that
can purchase a model response. Its executable source is
`src/lib/model-operations/contract.ts`; this document explains the operator
responsibilities that code cannot truthfully verify.

## What the application enforces

Each operation has exactly one scoped credential name, bounded input and
output, a maximum number of calls in one execution, bounded retries, a
version identity, and an explicit unavailable result. A missing or rejected
provider configuration never falls through to another provider, a generic
key, a larger model, web search, or a subscription-backed agent.

| Operation | Credential scope | Local execution ceiling | Unavailable result |
| --- | --- | --- | --- |
| Ask Civica | `ANTHROPIC_API_KEY_CHAT` | one reply; 12,000 input characters; 1,024 output tokens | fixed 503, no alternate answer path |
| Pulse classify | selected scoped Pulse provider key | 50 clusters; at most 150 classify calls; 4 attempts/call | cluster remains pending or enters review |
| Pulse verify | selected scoped Pulse provider key | 50 calls; 4 attempts/call | conservative review disposition |
| Pulse subject attribution | `ANTHROPIC_API_KEY_PULSE_CLASSIFIER` | 50 calls; 700 output tokens | unresolved subject, never inferred from the failure |
| Pulse review summary | `ANTHROPIC_API_KEY_PULSE_SUMMARIZE` | one call; 280 output tokens | source description remains available |
| Pulse backtest/evaluation | selected scoped Pulse provider key | 40 calls; 4 attempts/call | diagnostic stops without a quality conclusion |
| Bill summaries | `ANTHROPIC_API_KEY_BILLS_SUMMARIZE` | 25 calls of 20 bills each; 1,500 output tokens/call | title remains without generated prose |
| Stats SA PDF reconciliation | `ANTHROPIC_API_KEY_RECONCILIATION` | four calls; 1,024 output tokens/call | candidate skipped; prior canonical fact remains |

The legacy Pulse v1 classifier is retired and its compatibility export returns
without making a model request. `PULSE_COMPAT_THINKING` no longer expands the
provider output budget; an approved future experiment requires a new contract
and version, not an environment toggle.

Real evaluation runs are additionally capped at the available 40-call budget:
single-engine evaluations can read at most 20 rows and ensemble evaluations
divide the ceiling across their configured voters plus verifier. The backtest
runner reads at most 20 events from one case per invocation. `--mock` is
network-free and does not consume this budget.

## Provider-side monthly caps and alerts

Local ceilings prevent one request or job from expanding indefinitely. They do
not replace a provider billing limit. Before enabling a scoped key in Vercel,
the owner must set the matching provider workspace or project hard cap and an
alert at the following monthly USD thresholds. Do not enter the numeric limit
into repository files or evidence as proof that it is configured.

| Scope | Hard cap | Alert at |
| --- | ---: | ---: |
| Ask Civica | $25 | $20 |
| Pulse classify, verify, and subject attribution | $50 | $40 |
| Pulse review summary | $5 | $4 |
| Pulse backtest/evaluation | $10 | $8 |
| Bill summaries | $10 | $8 |
| Stats SA reconciliation | $10 | $8 |

For Anthropic, create the scoped key in the matching non-default workspace,
set the workspace's lower spend and rate limits, and alert the accountable
owner. The Usage and Cost API can group usage by API key or workspace for
reconciliation; its admin key is not an inference credential and must not be
added to Civica runtime configuration. For DeepSeek, GLM, and OpenAI, apply
the closest provider-native project/key spend cap and alert available in the
account; the in-app call, retry, and approved-model ceilings remain mandatory
even if that provider has no compatible spend-limit control.

## Version and change control

Changing provider, model, output ceiling, retry ceiling, or call ceiling creates
a deterministic `model-operation/sha256:*` version. Ask Civica writes this
version in its content-free audit record. Bill summaries place it in the cache
key, so a new model cannot silently reuse prior generated prose. Stats SA rows
retain the model version in their source payload. Pulse classify/verify and
subject-attribution provider/model choices are already part of the persisted
classification configuration hash and stage-version envelope.

An operator must review a planned model/provider change, update the checked
contract and any affected runtime snapshot, run the model-operation and Pulse
validators, and record the rationale without prompts, payloads, exception
text, account identifiers, or credentials.

## Key and incident hygiene

- Never reuse a chat, Pulse, bill, review, or reconciliation inference key.
- Never log keys, provider exception objects, request payloads, model response
  text, URLs containing credentials, or provider-account identifiers.
- A missing key disables only its named feature. A rejected Pulse
  provider/model disables that configured pass; it cannot select a substitute.
- Rotate a suspected key in its provider account, remove it from Vercel, then
  add a replacement only to the matching scope. Record only the date, scope,
  owner role, and redacted outcome.

## Primary-source verification

Verified 2026-07-18:

- [Anthropic rate limits and spend limits](https://platform.claude.com/docs/en/api/rate-limits): organization caps, lower workspace limits, response headers, and rate-limit behavior.
- [Anthropic Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api): cost and usage reporting by workspace/API key, and alerting use cases.

Run `npm run validate:model-operations` after any model call, model
configuration, credential name, failure behavior, or cost-control change.
