# Pulse classifier cost resolution v1 — cheap-model replacement for the paid classify→verify path

Status: research/proposal, no code changed. Companion to two existing
planning docs — the classify→verify design
(`pulse-classification-confidence-methodology-v1.md`) and the pause
decision (`pulse-pause-and-attribution-bug-2026-05-06.md`, ~$30/day
spend). Both companion docs live in the owner's home-level plan directory
(`/Users/fernandobalino/civica/plan/`, i.e. `~/civica/plan/`), NOT in this
repo's `plan/` (`/Users/fernandobalino/Projects/civica/plan/`) — so a
reader cloning the repo won't find them alongside this file; they are on
the owner's machine only. Written 2026-07-05.

## 1. What exists today

Two separate paths feed the Pulse pipeline, and they are not in conflict —
this doc only proposes changing the second one:

- **Daily subscription-path routine** (the `pulse-daily` skill). GDELT feeds
  ~200 raw events/day into ~8–20 clusters/day; the Claude Code agent (running
  on the Max subscription, not the API) classifies each cluster and applies
  the result via `writeEvent`. **This already costs $0** in API terms and is
  unaffected by anything in this document.
- **Paid API path** (`src/lib/pulse/v2/classify.ts`, model constant
  `claude-sonnet-4-6`, called with `ANTHROPIC_API_KEY_PULSE_CLASSIFIER`). This
  is the scale/backtest path — the one the owner paused at ~$30/day
  (~$900/mo). It runs a two-pass **classify → verify** design (see
  `classifier-prompt.ts`):
  1. **CLASSIFY** (`max_tokens: 800`) — assigns category, severity tier,
     severity value, a named runner-up category, and self-confidence.
  2. **VERIFY** (`max_tokens: 500`) — an independent second pass that reads
     the same source and actively tries to *refute* the first pass on four
     axes (category, severity, subject country, "is this even a real
     event"), yielding high/medium/low confidence.
  Auto-publish gate: `confidence === "low"` OR the severity tier is in
  `HUMAN_REVIEW_TIERS` → routed to human review (`pulse_events_v2.published
  = false`); otherwise auto-published.
  A **backtest harness** (`backtest.ts`) already exists, running the
  identical classify→verify prompts against curated `backtest_cases` /
  `backtest_events` (named historical shocks) and scoring trajectories
  against expected directions — this is the re-validation mechanism section
  5 below assumes, not something new to build.

This document proposes a replacement **only for the classify pass** of the
paid path (and evaluates whether the verify pass can also move), while
preserving the two-pass architecture, the human-review gate, and the
backtest harness as the quality floor.

## 2. Workload assumption (as specified)

- 200 events/day → clustered to ~8–20 clusters/day for the subscription
  path; this doc uses the **conservative worst case of 200 classify calls/day**
  (one per raw event, no clustering credit) so the estimate is not
  optimistic. Where clustering is credited, that's called out explicitly.
- Per classify pass: ~1,500 input tokens (cluster title + body + taxonomy
  system prompt) + ~300 output tokens (JSON response, `max_tokens: 800`
  ceiling but observed completions are short JSON blobs).
- Verify pass doubles the call count on the *same* event but is a shorter
  prompt (a classification, not raw source text, is the primary input) —
  this doc uses the same 1,500 in / 300 out shape ("×2 for the verify
  pass") as instructed, which is conservative since the actual verify
  prompt in `classifier-prompt.ts` is shorter than the classify system
  prompt.

**Daily token volume (200 events, classify + verify, no clustering credit):**

```
Input:  200 events × 2 passes × 1,500 tokens = 600,000 input tokens/day
Output: 200 events × 2 passes ×   300 tokens = 120,000 output tokens/day
```

**Realistic clustered volume** (~15 clusters/day, midpoint of 8–20):

```
Input:  15 × 2 × 1,500 = 45,000 input tokens/day
Output: 15 × 2 ×   300 =  9,000 output tokens/day
```

The $30/day historical spend implies the paid path was NOT running on
clustered volume alone — likely backtests, retries, or per-raw-event calls
rather than per-cluster. Both volume assumptions are carried through
section 4 so the owner can see the cost at either scale.

## 3. Model options — pricing, reliability, limits, privacy (July 2026)

All prices are official, per 1M tokens, standard (non-batch) API rates
unless noted. "Batch" = async discount tier, typically not usable for a
same-day publish cadence but relevant if classify runs as an end-of-day job.

### Anthropic

| Model | Input | Output | Batch in/out | Notes |
|---|---|---|---|---|
| **Claude Haiku 4.5** | $1.00/MTok | $5.00/MTok | $0.50 / $2.50 | Cache read $0.10/MTok (90% off). [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 5 (intro, through Aug 31 2026) | $2.00/MTok | $10.00/MTok | $1.00 / $5.00 | Cheaper than Sonnet 4.6 until Sep 1 2026, then $3/$15. [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 4.6 (current classify.ts model) | $3.00/MTok | $15.00/MTok | $1.50 / $7.50 | What's running today. |

- **Structured output**: native tool-use / JSON-schema-constrained output;
  the codebase already parses Claude JSON responses reliably in
  production (`parseClassify`/`parseVerify`).
- **Rate limits**: tiered (Start/Build/Scale), scales with spend history;
  not a constraint at 200–400 calls/day.
- **Zero data retention**: available on eligible Commercial/Enterprise API
  accounts by request — inputs/outputs are not stored at rest except for
  abuse-safety classifier results. [Anthropic Privacy Center](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to) · [API data retention docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Data is not used for training on Commercial/Enterprise terms regardless
  of ZDR status. [Anthropic consumer terms update](https://www.anthropic.com/news/updates-to-our-consumer-terms)

### DeepSeek (V3/R1 deprecating → V4-flash/V4-pro)

Important: **`deepseek-chat` and `deepseek-reasoner` (the V3/R1 model
names asked about) are scheduled for deprecation on 2026-07-24**, replaced
by `deepseek-v4-flash` (non-thinking = old chat behavior; thinking mode =
old reasoner behavior) and `deepseek-v4-pro`. [DeepSeek API pricing docs](https://api-docs.deepseek.com/quick_start/pricing)

| Model | Input (cache miss) | Input (cache hit) | Output |
|---|---|---|---|
| **deepseek-v4-flash** | $0.14/MTok | $0.0028/MTok | $0.28/MTok |
| deepseek-v4-pro | $0.435/MTok | $0.0036/MTok | $0.87/MTok |

- **Structured output**: `response_format: {type: "json_object"}` JSON
  mode exists but DeepSeek's own docs flag it can occasionally return
  **empty content** on json mode, requiring prompt-level mitigation — a
  real reliability caveat for an unattended pipeline. [DeepSeek JSON mode guide](https://api-docs.deepseek.com/guides/json_mode)
- **Rate limits**: no fixed RPM quota; instead a dynamic **concurrency**
  cap (documented ~2,500 concurrent for v4-flash, ~500 for v4-pro),
  degrading under load with HTTP 429 rather than a hard per-key ceiling.
  [Rate limit docs](https://api-docs.deepseek.com/quick_start/rate_limit)
- **Privacy**: DeepSeek's policy states **paid API accounts are not used
  for model training by default** as of a March 2026 policy update, but
  data is processed on servers in mainland China, subject to Chinese
  cybersecurity/data-security law and government access requirements —
  a materially different posture than Anthropic ZDR. [DeepSeek privacy analysis](https://skywork.ai/skypage/en/deepseek-data-privacy-security-guide/2047585299882700800)

### GLM / Zhipu (Z.ai)

| Model | Input | Output | Notes |
|---|---|---|---|
| **GLM-4.5-Flash** | **Free** | **Free** | Zhipu's stated free lightweight tier. |
| **GLM-4.7-FlashX** | $0.07/MTok | $0.40/MTok | Cheap paid tier, faster/larger than Flash. |
| GLM-4.5-Air | $0.20/MTok | $1.10/MTok | |
| GLM-4.6 / GLM-4.7 (flagship-tier) | $0.60/MTok | $2.20/MTok | |

[Z.ai pricing docs](https://docs.z.ai/guides/overview/pricing)

- **Structured output**: GLM-4.6/4.7 support JSON mode + function calling;
  third-party deployments (e.g. DeepInfra) report GLM tool-calling as
  "more structured and accurate" than prior GLM generations, though this
  is vendor/blog-sourced, not an Anthropic-grade benchmark. [Cirra: GLM-4.6 tool calling analysis](https://cirra.ai/articles/glm-4-6-tool-calling-mcp-analysis) · [DeepInfra GLM-4.7-Flash benchmarks](https://deepinfra.com/blog/glm-4-7-flash-api-benchmarks)
- **Rate limits**: not comprehensively documented in English-language
  sources found; treat as unverified for a production SLA until tested.
- **Privacy**: Zhipu is a Chinese company; same National Intelligence Law
  / Data Security Law exposure as DeepSeek. Zhipu's own app has been
  publicly cited by a Chinese security body for over-collecting personal
  data, which is a reputational red flag independent of the legal
  jurisdiction issue. [Z.ai privacy policy](https://docs.z.ai/legal-agreement/privacy-policy) · [MLex: Zhipu cited for data-protection violations](https://www.mlex.com/mlex/articles/2343151/chinese-ai-startup-kimi-zhipu-among-35-apps-cited-for-data-protection-violations)

### Qwen (Alibaba Model Studio)

| Model | Input | Output | Notes |
|---|---|---|---|
| **Qwen-Turbo** | $0.05/MTok | $0.20/MTok | Cheapest usable tier. |
| Qwen-Plus | $0.40/MTok | $1.20/MTok | |
| Qwen3.7-Max | $1.25/MTok (promo) | $3.75/MTok (promo) | List $2.50/$7.50. |

[Qwen/Alibaba pricing aggregation](https://pricepertoken.com/pricing-page/provider/qwen) · [Alibaba Cloud Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

- Batch API ~50% off; ~90-day 1M-token free trial on new accounts
  (Singapore endpoint).
- **Structured output**: JSON mode/function calling supported on Qwen3
  family; Alibaba markets an OpenAI-compatible endpoint.
- **Privacy**: Alibaba states it does not use API data for model training
  and offers a Singapore (non-mainland-China) regional endpoint, a
  materially better data-residency story than DeepSeek/Zhipu if the
  Singapore region is used explicitly. Still a China-headquartered parent
  entity. [Alibaba Cloud privacy policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy)

### Google Gemini

| Model | Input | Output | Batch in/out |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | $0.10/MTok | $0.40/MTok | $0.05 / $0.20 |
| **Gemini 3.1 Flash-Lite** | $0.25/MTok | $1.50/MTok | $0.125 / $0.75 |
| Gemini 2.5 Flash | $0.30/MTok | $2.50/MTok | $0.15 / $1.25 |
| Gemini 3 Flash | $0.50/MTok | $3.00/MTok | — |
| Gemini 3.5 Flash | $1.50/MTok | $9.00/MTok | $0.75 / $4.50 |

[Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

- **Structured output**: Gemini has first-class `response_schema`
  constrained JSON output (arguably the most mature of the non-Anthropic
  options for guaranteed-valid JSON).
- **Rate limits**: generous free tier + paid tiers scale with billing
  history; well-documented, enterprise-grade infra (this is Google Cloud).
- **Privacy**: standard Google Cloud/Vertex enterprise data-processing
  terms — data not used for training on paid API tier, mainstream
  compliance posture (SOC2/ISO), a genuine advantage over the three
  China-domiciled options above for a US-domiciled academic project.

### OpenAI

| Model | Input | Cached input | Output | Batch (50% off both) |
|---|---|---|---|---|
| **GPT-5.4-nano** | $0.20/MTok | $0.02/MTok | $1.25/MTok | $0.10 / $0.625 |
| GPT-5.4-mini | $0.75/MTok | $0.075/MTok | $4.50/MTok | $0.375 / $2.25 |

[OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

- **Structured output**: OpenAI's `response_format: json_schema` with
  strict mode is widely regarded as the most reliable constrained-JSON
  implementation in the industry (schema-validated at decode time, not
  just prompted).
- **Rate limits / privacy**: enterprise-grade, well-documented tiers;
  standard US data-processing terms, not used for training on API tier
  by default.

### Mistral

| Model | Input | Output |
|---|---|---|
| **Mistral Small** | $0.10/MTok | $0.30/MTok |

[Mistral pricing](https://mistral.ai/pricing/)

- EU-domiciled (French company) — potentially attractive if data
  residency in the EU (rather than US or China) ever becomes a
  requirement. JSON mode supported; smaller ecosystem of third-party
  reliability benchmarks than the majors.

### Open-weight self-hosting via inference providers (Groq / Together / Fireworks)

| Provider/model | Input | Output | Notes |
|---|---|---|---|
| Groq — Llama 3.3 70B | $0.59/MTok | $0.79/MTok | LPU hardware, very low latency. |
| Groq — DeepSeek R1 Distill Llama 70B | $0.75/MTok | $0.99/MTok | |
| Groq — Kimi K2 | $1.00/MTok | $3.00/MTok | Strongest reasoning option on Groq. |

[Groq pricing](https://groq.com/pricing) · [AI Pricing Guru: Groq 2026](https://www.aipricing.guru/groq-pricing/)

- Batch + prompt caching stack to ~25% of on-demand rate.
- This tier is **not obviously cheaper** than DeepSeek-V4-Flash or GLM
  direct APIs for this workload size (200–400 calls/day is nowhere near
  where "own your inference" pricing beats managed APIs) — it mainly
  buys speed and US-based inference infrastructure (Groq, Together, and
  Fireworks are all US companies), which is a genuine data-residency
  argument distinct from the model weights' country of origin. Worth
  revisiting only if volume grows an order of magnitude (e.g. per-raw-
  event classification at global GDELT scale, not per-cluster).

## 4. Realistic daily/monthly cost at our workload

Using the two volume scenarios from §2, and Anthropic Haiku 4.5 as the
apples-to-apples "cheap-but-same-vendor" baseline plus the two cheapest
plausible non-Anthropic picks:

**Scenario A — 200 raw events/day, no clustering credit (conservative):**
600,000 input + 120,000 output tokens/day, classify+verify combined.

| Model | Input cost/day | Output cost/day | **Total/day** | **Total/mo (×30)** |
|---|---|---|---|---|
| Claude Sonnet 4.6 (current) | 600K × $3/M = $1.80 | 120K × $15/M = $1.80 | **$3.60** | **~$108** |
| Claude Haiku 4.5 | 600K × $1/M = $0.60 | 120K × $5/M = $0.60 | **$1.20** | **~$36** |
| DeepSeek V4-Flash | 600K × $0.14/M = $0.084 | 120K × $0.28/M = $0.034 | **$0.118** | **~$3.54** |
| Gemini 3.1 Flash-Lite | 600K × $0.25/M = $0.15 | 120K × $1.50/M = $0.18 | **$0.33** | **~$9.90** |
| GLM-4.7-FlashX | 600K × $0.07/M = $0.042 | 120K × $0.40/M = $0.048 | **$0.09** | **~$2.70** |
| GPT-5.4-nano | 600K × $0.20/M = $0.12 | 120K × $1.25/M = $0.15 | **$0.27** | **~$8.10** |

**Scenario B — realistic clustered volume (~15 clusters/day):**
45,000 input + 9,000 output tokens/day.

| Model | **Total/day** | **Total/mo** |
|---|---|---|
| Claude Sonnet 4.6 (current) | $0.27 | ~$8.10 |
| Claude Haiku 4.5 | $0.09 | ~$2.70 |
| DeepSeek V4-Flash | $0.0089 | ~$0.27 |
| GLM-4.7-FlashX | $0.0068 | ~$0.20 |

**The math does not reconcile with the historical $30/day spend under
either scenario** — even Scenario A's conservative 200-events/day, no-
clustering-credit assumption on the *current* Sonnet 4.6 model comes to
~$3.60/day, an order of magnitude below the ~$30/day the owner actually
paid. This means the historical spend included cost drivers this doc's
token-math doesn't capture — most plausibly **repeated backtest runs**
(the harness in `backtest.ts` re-classifies the same curated cases across
many historical windows), **retries on failures**, or a **substantially
larger per-cluster prompt** (e.g. multi-source `pulse_sources` bodies
concatenated in, not just title+body) than the 1,500-token assumption
given in this task. **Recommendation: instrument actual token usage
(`usage.input_tokens`/`usage.output_tokens` already returned by the
Anthropic SDK on every call) for one real week before finalizing a
target budget** — the $900/mo figure may be dominated by backtest volume
that a cheap-classify-pass swap won't touch at all, in which case the
real lever is capping/scheduling backtest runs, not swapping models.

## 5. Proposed architecture — cheap classify, escalate on low confidence

**Two-tier classify, keep the existing verify semantics as the escalation
trigger — do not remove the verify pass, retarget it:**

1. **CLASSIFY pass → cheap model.** Route the first pass (category,
   severity, runner-up, self-confidence) to **Claude Haiku 4.5** as the
   primary recommendation (see §6 for why not the absolute-cheapest
   options). Haiku 4.5 is same-vendor, so the existing `classifier-
   prompt.ts` prompts, JSON-parsing (`parseClassify`), and Anthropic SDK
   plumbing in `classify.ts` require **zero prompt rewrites** — only the
   `MODEL` constant changes for the classify call. This is the
   lowest-migration-risk move available.
2. **VERIFY pass → stays on the stronger model, but gate it by
   self-confidence.** Today verify always runs on `claude-sonnet-4-6`.
   Keep the model but only make it the routine second pass for
   `self_confidence` above some threshold (e.g. ≥0.7 from the cheap
   classify pass); for classify results below that threshold, run
   verify AND flag for human review regardless of what verify returns
   — i.e. cheap-model uncertainty is itself grounds for review, not just
   a green light to spend more compute confirming it. This uses the
   *existing* `HUMAN_REVIEW_TIERS` / `published = false` gate — no new
   review-queue machinery needed, only a new gating input
   (`self_confidence` threshold) feeding the same boolean.
3. **Do not send the verify pass to a cheap model in this first
   migration.** Verify is specifically an adversarial-refutation pass;
   the paid path's entire value proposition (vs. the free subscription
   path) is running this pass on a strong, independently-reasoning
   model. Moving verify to a cheap model risks correlated failure
   modes (the same cheap model failing to catch its own mistake in
   both passes) — this is the single highest-risk change available and
   should be evaluated only after Step 1 has banked evidence (§7).
4. **Spot-check sampling stays, formalized as a recurring check, not a
   one-time migration gate.** After migration, run N% (recommend 10%)
   of cheap-classify outputs through Sonnet 4.6/5 as a shadow re-classify,
   logged but not gating publication, on a rolling weekly cadence — this
   catches silent drift (e.g. a cheap-model provider quietly changing
   weights) that a single pre-migration test cannot.

### Why Haiku 4.5 over the cheaper non-Anthropic options for classify

- **Same vendor, same SDK, same JSON-parsing code, same prompt file.**
  `classifier-prompt.ts` is explicitly the "single source of truth"
  shared between `classify.ts` and `backtest.ts` — swapping in a
  different vendor's API (DeepSeek/GLM/Gemini/OpenAI) means adding a
  second HTTP client, a second response-schema adapter, and revalidating
  JSON-parse robustness against a model that was never tested against
  these exact prompts. That engineering cost is small in absolute terms
  but is not zero, and it is the single largest failure surface for an
  unattended daily cron feeding a published academic signal.
- Haiku 4.5 at Scenario A's conservative volume is **~$36/mo** — a
  97% reduction from the historical ~$900/mo baseline the owner walked
  away from, without introducing a second vendor, a second data-
  processing jurisdiction, or a second JSON-reliability profile into the
  pipeline.
- The absolute-cheapest options (DeepSeek V4-Flash ~$3.54/mo, GLM-4.7-
  FlashX ~$2.70/mo, Gemini 3.1 Flash-Lite ~$9.90/mo) are worth adopting
  **only if** Haiku 4.5's cost is still judged too high after real usage
  is measured (§4) — at this workload size the absolute dollar delta
  between Haiku 4.5 and the cheapest Chinese-hosted models is under
  $35/month, which does not obviously justify the added vendor-diversity
  risk (see §7 quality-evidence bar) for a citable academic signal. If
  budget pressure persists after real-volume measurement, Gemini 3.1
  Flash-Lite is the better second choice over DeepSeek/GLM specifically
  because of its US/Google data-processing posture and mature
  `response_schema` constrained JSON (lower reliability risk than
  DeepSeek's documented empty-JSON-mode failure mode).

## 6. Migration steps

1. **Instrument first.** Add `usage.input_tokens`/`usage.output_tokens`
   logging to the current `classify.ts`/`backtest.ts` calls (the
   Anthropic SDK already returns this on every response) for one real
   week of production + any scheduled backtests, to reconcile the
   $30/day historical figure against this doc's token-math (§4) before
   picking a target budget.
2. **Add a `CLASSIFY_MODEL` constant separate from `MODEL`** in
   `classify.ts`. Today a single module-level `MODEL` const
   (`classify.ts:64`) drives both passes: it names the model in the two
   audit-record objects (`classify.ts:237` in `classifyRun`,
   `classify.ts:249` in `verifyRun`) AND in the two live
   `client.messages.create()` calls (`classify.ts:292` in `runClassify`,
   `classify.ts:334` in `runVerify`). To pin classify and verify to
   different models, split `MODEL` into `CLASSIFY_MODEL`/`VERIFY_MODEL`
   and update all four sites (the two API calls are the load-bearing
   ones; the two audit fields just record which model ran). This is the
   only required code change to try Haiku 4.5 on the classify pass.
3. **Run the existing backtest harness (`backtest.ts` /
   `backtest_cases`) with `CLASSIFY_MODEL = claude-haiku-4-5` and verify
   still on `claude-sonnet-4-6`.** Compare backtest verdicts (trajectory
   vs. expected direction) against the current all-Sonnet baseline on
   every named historical case already curated there. Any case that
   flips from "correct direction" to "wrong direction" is a hard blocker.
4. **Run an agreement-rate study on held-out historical clusters, not
   just the curated backtest cases** (the backtest cases are a small,
   hand-picked set of major shocks — not representative of routine day-
   to-day classification volume). Recommend **N=200 historical clusters**
   (a full week+ of typical volume) already present in `raw_events`/
   `pulse_events_v2`: re-classify each with the cheap-model classify pass
   + existing verify, and compute category-agreement rate and severity-
   tier-agreement rate against the original Sonnet-4.6 classification
   that was actually published. See §7 for the required bar.
5. **Ship classify-model swap behind the existing human-review gate,
   unchanged.** No auto-publish threshold changes on day one — let the
   existing `HUMAN_REVIEW_TIERS`/low-confidence gate absorb any quality
   regression into the review queue rather than into published data,
   and watch the review-queue volume for a 2-week soak before touching
   the gate's thresholds.
6. **Only after the soak period, consider the confidence-threshold
   routing in §5.2** (routing low-self-confidence classify results to
   mandatory review even after a "high" verify confidence) as a second,
   separate change — do not ship the model swap and the routing-logic
   change in the same deploy, so a regression can be attributed to one
   or the other.

## 7. Quality evidence required before switching (explicit bar)

Because Pulse classification directly feeds a published, academic-facing
governance signal (Civica Index/Pulse — see project decisions on
methodology rigor), the following evidence gate applies before Haiku 4.5
(or any cheaper model) replaces Sonnet 4.6 on the classify pass in
production:

- **Category agreement rate ≥ 90%** against the current classifier on
  N=200 historical clusters (stratified across at least 5 severity
  tiers and ideally multiple event categories, not just the easy/common
  ones) — an exact match on the chosen `category` field.
- **Severity-tier agreement rate ≥ 85%** on the same N=200 set — an
  exact match on `severity_tier` (a 1-tier miss, e.g. moderate_neg vs.
  severe_neg, is a partial failure worth tracking separately from a
  clean miss).
- **Zero category-direction flips** (i.e. no case where the cheap model
  assigns a `_pos` category where Sonnet assigned a `_neg` category or
  vice versa) — a directional flip is disqualifying regardless of the
  aggregate agreement rate, since it would silently invert a country's
  Pulse score contribution.
- **All curated `backtest_cases` must retain their existing verdict**
  (correct/incorrect trajectory direction vs. expected) under the new
  classify model — any case that currently passes and would newly fail
  blocks the swap for that case's category until investigated.
- **JSON-parse failure rate ≤ 1%** across the N=200 set (a proxy for
  the "structured output reliability" concern raised for non-Anthropic
  models — this bar applies to Haiku 4.5 too, since even same-vendor
  model swaps can shift output formatting habits).
- **Human-review queue volume does not exceed ~2x its pre-swap baseline**
  during the 2-week soak (§6 step 5) — a large jump would mean the cheap
  model is systematically less confident, which is not a correctness
  failure per se but does erode the free/cheap-path benefit if it just
  shifts the review burden.

If any bar is missed, the fallback is **not** to abandon the migration
outright — it's to identify the failing category/tier stratum and either
(a) keep that stratum on Sonnet 4.6 while migrating the rest, or (b) hold
the swap and re-test after a prompt adjustment specific to the cheap
model's failure pattern.

Note that option (a) is **not** a free config change with today's code.
`classify.ts` does no per-cluster or per-category model selection: a
single module-level `MODEL` const (`classify.ts:64`) is applied to every
cluster in both the classify and verify passes, and `classifyOne()`
processes one cluster at a time with no branching on its category or
severity tier. Routing a specific stratum to a different model would
require new selection logic inside `classifyOne()` (e.g. choosing the
model from the cluster's predicted/known category or tier) on top of the
`CLASSIFY_MODEL`/`VERIFY_MODEL` split from §6 step 2 — a small but real
code change, not an existing capability.

## 8. Recommendation

- **Primary recommendation: migrate the classify pass only to Claude
  Haiku 4.5, keep verify on Sonnet 4.6 (or Sonnet 5 once its introductory
  pricing — $2/$10, cheaper than 4.6's $3/$15 — is confirmed compatible),
  gated by the evidence bar in §7.** Estimated realistic cost:
  **~$36/mo** at the conservative 200-events/day/no-clustering-credit
  volume, or **~$3/mo** at realistic clustered volume (~15/day) — either
  way, a **95–99.7% reduction from the $900/mo the owner walked away
  from**, while remaining same-vendor (lowest engineering/reliability
  risk) and keeping the two-pass, human-review-gated architecture intact.
- **This is not free** — it is not equivalent to the $0 subscription-path
  status quo. It exists specifically to serve the use case the
  subscription path cannot: **scale runs (classifying large historical
  backfills) and repeatable backtests**, which by design need to run
  outside an interactive Claude Code session. If the owner's actual need
  is fully covered by the daily subscription-path routine and the
  existing backtest harness is run rarely enough to not matter, the
  honest recommendation is: **don't turn the paid path back on at all**,
  and only revisit this doc when a concrete scale/backtest need
  resurfaces (e.g. a large historical backfill for a new methodology
  version, or a pre-publication backtest re-validation pass).
- **Before any switch, run the §6 instrumentation step.** The $30/day
  historical figure doesn't reconcile with this doc's token math even
  under the conservative no-clustering-credit assumption (§4) — it's
  quite possible the real spend driver was backtest-run frequency, not
  per-event classify/verify cost, in which case the correct fix is
  scheduling discipline on backtests, not a model swap, and the model
  swap should be evaluated on its own merits against actual measured
  volume rather than the workload assumption given in this task.
- **Do not move the verify pass to a cheap or non-Anthropic model in
  this round.** It is the load-bearing quality check in the published
  methodology; the dollar savings from also discounting it are small
  (verify is roughly the same token count as classify, so migrating it
  too would save perhaps another ~$18–90/mo depending on model choice)
  relative to the correctness risk of losing an independently-reasoning
  second pass on a citable signal.
- **Do not adopt a China-domiciled model (DeepSeek, GLM/Zhipu, Qwen) for
  a published academic-facing classifier without an explicit, separate
  data-governance sign-off from the owner.** The dollar savings vs.
  Haiku 4.5 at this workload size (single-digit dollars to ~$30/month)
  do not obviously clear the bar of introducing a foreign-government-
  accessible data-processing jurisdiction into a pipeline whose output
  is a citable governance signal about foreign governments — this is a
  optics/legitimacy risk specific to Civica's subject matter, not a
  generic privacy concern that applies equally to any SaaS use case.

## Sources

- [Anthropic — Pricing (Claude Platform Docs)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Privacy Center — zero data retention scope](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to)
- [Anthropic — API and data retention docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [Anthropic — Updates to Consumer Terms and Privacy Policy](https://www.anthropic.com/news/updates-to-our-consumer-terms)
- [DeepSeek API Docs — Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [DeepSeek API Docs — Rate Limit & Isolation](https://api-docs.deepseek.com/quick_start/rate_limit)
- [DeepSeek API Docs — JSON Output guide](https://api-docs.deepseek.com/guides/json_mode)
- [DeepSeek data privacy/security guide (Skywork, 2026)](https://skywork.ai/skypage/en/deepseek-data-privacy-security-guide/2047585299882700800)
- [Z.ai (Zhipu) — Pricing docs](https://docs.z.ai/guides/overview/pricing)
- [Z.ai — Privacy Policy](https://docs.z.ai/legal-agreement/privacy-policy)
- [MLex — Zhipu/Kimi cited for data-protection violations](https://www.mlex.com/mlex/articles/2343151/chinese-ai-startup-kimi-zhipu-among-35-apps-cited-for-data-protection-violations)
- [Cirra — GLM-4.6 tool calling / MCP analysis](https://cirra.ai/articles/glm-4-6-tool-calling-mcp-analysis)
- [DeepInfra — GLM-4.7-Flash API benchmarks](https://deepinfra.com/blog/glm-4-7-flash-api-benchmarks)
- [Alibaba Cloud — Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
- [Alibaba Cloud — International website privacy policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy)
- [pricepertoken.com — Qwen provider pricing aggregation](https://pricepertoken.com/pricing-page/provider/qwen)
- [Google — Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI — API Pricing](https://developers.openai.com/api/docs/pricing)
- [Mistral AI — Pricing](https://mistral.ai/pricing/)
- [Groq — On-Demand Pricing](https://groq.com/pricing)
- [AI Pricing Guru — Groq API Pricing Guide 2026](https://www.aipricing.guru/groq-pricing/)
