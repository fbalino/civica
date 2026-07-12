# Pulse cross-model ensemble classifier — implementation notes (2026-07-05)

Owner decision (2026-07-05): replace the single-engine classify pass with a
THREE-MODEL ensemble — one classify pass each on heterogeneous vendors so
errors are independent (unlike the retired same-model 3-temperature scheme):

- DeepSeek `deepseek-v4-flash`
- GLM `glm-4.7-flashx` (fall back to `glm-4.7` if flashx JSON quality
  disappoints in a smoke test)
- Anthropic Haiku 4.5 (`claude-haiku-4-5`)

## GLM flashx smoke-test result (2026-07-05) — FALL BACK to flagship glm-4.7
The owner's instruction: default to `glm-4.7-flashx`, fall back to `glm-4.7`
if flashx disappoints in the smoke test. **It disappointed → default switched
to `glm-4.7`.**

- **Latency (the disqualifier).** Measured per-call latency, flashx vs
  flagship, 3 calls each on the same clear-cut prompt:
  - `glm-4.7-flashx`: 74s (throw), 74s (throw), 29s — repeatedly EXCEEDS the
    60s request timeout and throws; in the ensemble this made flashx a
    non-functional voter that "degraded" most clusters and stalled the run.
  - `glm-4.7` (flagship): 4.5s, 4.0s, 3.1s — fast, reliable, sound JSON
    (`judicial_purge` / `judicial_independence_rollback`).
  Flashx's JSON *format* parses when it answers (0% parse failure at N=25),
  but its operational reliability disappoints — so the fallback fires.
- **Abstention note (applies to BOTH GLM tiers, informational).** GLM returns
  `category:"none"` on many sampled clusters where DeepSeek/Haiku classify a
  real category. Inspecting raw output, these are GENUINE, well-reasoned
  abstentions with valid JSON (e.g. GLM correctly reads "UN Human Rights
  Council session in Geneva" as an inter-state/diplomatic act = out of scope,
  and a "caning violates torture prohibition" story as a legal opinion, not an
  enacted event). The stored labels those clusters carry came from a looser
  prior classifier — consistent with the owner's "past labels are not gold."
  GLM applying the scope rules more strictly than the incumbent is legitimate
  independent judgment (the point of a heterogeneous ensemble), but it does
  push the distribution toward `two_of_three`/deadlock and inflates the review
  queue — surfaced in the eval distribution.

Optional 4th voter: OpenAI `gpt-4.1-mini` (wired, inactive until
`OPENAI_API_KEY` exists and `PULSE_CLASSIFY_ENSEMBLE` names it).

## Consensus rules (as specified)
- **Category**: majority vote. 3/3 → `classifierAgreement = 'all'`; 2/3 →
  `'two_of_three'`; no majority → `'none'` → review queue, `published=false`.
- **Severity tier**: majority; ties broken toward the MORE SEVERE tier
  (conservative).
- **severityValue**: median of the runs that agree on the winning category.
- **Subject country**: the production `resolveSubjectJurisdiction()` step is a
  separate downstream Anthropic call (the classify prompt does not emit a
  subject country) — kept as the single post-consensus call, unchanged. The
  "no-majority → review" clause is driven by the category vote.
- **runner_up + self-confidence**: taken from the majority-category run with the
  highest self-confidence.

## Verify placement (published-gate semantics)
- `'all'` → verify STILL runs, on ONE engine: Anthropic Haiku 4.5 (cheap,
  same-vendor as the prompts) as the adversarial check.
- `'two_of_three'` → verify runs; a REFUTED verdict (`is_event=false` /
  `verdict='rejected'` / confidence `low`) downgrades to review.
- `'none'` → skip verify, straight to review.
- Existing gate preserved on top: severity tier in `HUMAN_REVIEW_TIERS` always
  routes to review; verify confidence `low` routes to review.

## Parallelism + degradation
- 3 classify calls via `Promise.allSettled` — one engine erroring degrades to
  2-voter mode (recorded). With 2 successful voters: agreement is `'all'` iff
  both agree (2/2), else `'none'`. With <2 voters → review.

## classifierRuns shape (ADDITIVE — legacy rows must stay readable)
Existing persisted + consumed shape has `{run, temp, model, category,
dimension, severityTier, severityValue, selfConfidence, rationale, raw}`.
Consumers: `PulseEventDetailCard.tsx`, admin `pulse-review/[id]/page.tsx`,
`queries-pulse-v2.ts`, `queries-pulse-review.ts`. I ADD `provider` and
`confidence` fields; keep every existing field. `run` widens `1|2|3` → number
(classify runs 1..N, verify run 10) so React keys don't collide.

## Env
- `PULSE_CLASSIFY_ENSEMBLE` — comma list of `provider:model` pairs. Default:
  `deepseek:deepseek-v4-flash,glm:glm-4.7-flashx,anthropic:claude-haiku-4-5`.
  If it names exactly ONE pair → single-engine mode (existing behavior).
- `PULSE_ENSEMBLE_VERIFY` — provider:model for the verify pass. Default
  `anthropic:claude-haiku-4-5`.
- New provider `openai` (api.openai.com, `OPENAI_API_KEY`, `gpt-4.1-mini`).

## Eval `--ensemble`
Runs the configured ensemble over N historical clusters (default 200). Loads
event text from `pulse_events_v2` (277 rows available; NOT via
`loadUnclassifiedClusters`, which excludes classified clusters). Reports the
DISTRIBUTION only (no scoring vs stored labels):
unanimous %, two-of-three %, deadlock %, engine-pair agreement matrix,
per-engine `none`-category rate, verify-refutation rate on majorities,
projected review-queue size/day at current volume, measured cost/event + /mo.
Writes dated JSON to `tmp/`.

## Gates
`npx tsc --noEmit`, `validate:sync-freshness`, `validate:content-templates`,
no bare `ANTHROPIC_API_KEY` (Anthropic voters use
`ANTHROPIC_API_KEY_PULSE_CLASSIFIER`).
