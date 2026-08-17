# Pulse subscription-runtime resolution v1 — zero-marginal-cost classify path

> **Date correction (recorded 2026-08-09).** This record was created with a 2026-08-09 session date. Fernando stated on 2026-08-09 that he had not worked on the project since late July 2026; the owner statements recorded here were made in the late-July 2026 working sessions, and the 2026-08-09 date is an artifact of when the record was written.


Status: **adopted 2026-08-17** (owner go-ahead recorded below). Written at
the owner's direction after he rejected any recurring API spend for Pulse.
Companion to `pulse-classifier-cost-resolution-v1.md` (July 2026) and the
preregistered `pulse-validation-protocol/v1`
(`plan/evidence/PUL-040/start-readiness.json`, status
`preregistered_not_started` — nothing in this proposal alters a started
observation).

## 1. Problem

The owner's real billing for the paid classify path was ~$10–30/day across
two configurations (Sonnet-era and the DeepSeek/GLM rebuild). The July cost
resolution could not reconcile that spend with token math and recommended
metering before trusting any projection. The owner has now set the budget
constraint explicitly: Pulse may not carry a recurring API cost. He holds
active subscriptions recorded in `data/program-cost-effort-ledger.v1.json`:
OpenAI Codex ($200/mo), two Anthropic Claude plans (2 × $200/mo), xAI Grok
($30/mo), Moonshot Kimi ($199/mo), plus Cursor.

## 2. Proposed design

Replace the paid HTTP-API classify/verify/attribution calls with
subscription-authenticated CLI invocations on the owner's Mac. Everything
else in the pipeline is already model-free and unchanged (ingest, cluster,
corroborate, score run on Vercel/Neon at no model cost).

- **Voters (classify pass):** four provider-distinct subscription CLIs run
  headless with the same frozen classify prompt, each pinned to an
  owner-selected model (owner selection 2026-08-09): Codex → **GPT Terra
  5.6**, Claude Code → **Claude Sonnet 5**, Kimi CLI → **Kimi K3**, Grok
  CLI → **Grok 4.5**. Each CLI's model flag/config names the model
  explicitly, and every stored run records the model identifier the CLI
  reports back. Four heterogeneous vendors exceed the current three-vendor
  panel's diversity. Consensus maps onto the existing agreement semantics
  (4/4 and 3/4 as the strong tiers; no majority → review).
- **Verify pass and subject attribution:** the Claude subscription (second
  plan), keeping the adversarial verify and the country-attribution step
  with the existing frozen prompts.
- **Stored evidence unchanged in shape:** every voter run is persisted as a
  provider/model/prompt-versioned classification run exactly as PUL-032/
  PUL-036 require; agreement is recomputed from stored provider-distinct
  runs only.
- **Publication safeguard preserved:** PUL-036's rule that
  subscription-agent classifications always queue for human review is NOT
  weakened. Every publication continues to require the owner's review
  decision in the existing SLA'd queue. At the measured volume (1–11 new
  clusters/day) this is minutes per day. Automatic publication remains
  disabled for subscription runs.
- **New method version:** this is a new classification configuration
  (models, transport, decoding) and MUST ship as a new runtime method
  version with regenerated runtime contract, never as a silent swap inside
  `pulse-v2.15-beta` (APR-D147 configuration identity).
- **Protocol supersession before start:** `pulse-validation-protocol/v1`
  freezes the API ensemble; it is superseded by a v2 that freezes the
  subscription configuration BEFORE the 90-day window starts, following the
  IDX-038 precedent of pre-outcome supersession with all prior artifacts
  preserved. The non-backdating rule and retention requirements carry over
  unchanged.

## 3. Operational requirements (owner-visible)

1. The owner's Mac runs a scheduled daily job (launchd) that drains the
   classification queue. The Mac must be on at some point each UTC day;
   the queue design (PUL-032 states, bounded retries, terminal records)
   makes catch-up safe and re-runs free.
2. Missed days are recorded honestly as pipeline outage observability
   (PUL-022 evaluates outages); they are data, not silent gaps.
3. The daily review queue remains the owner's standing commitment
   (24h/72h/7d severity SLAs, PUL-033).
4. The window start (PUL-040) is recorded only after one complete compliant
   cycle under the new frozen method.

## 4. Disclosed limitations

- **Models are explicitly selected; decoding parameters are not.** The
  configuration pins the four named models above through each CLI's model
  setting. What the CLIs' non-interactive modes do not expose is
  temperature/seed control, so the frozen configuration records
  provider-default decoding.
- **Run-level model logging.** Every stored run records the model
  identifier the CLI reports for that call. In the unlikely event a
  provider revises what a selected model name serves mid-window, the logs
  make it visible and the superseding protocol predeclares that it is
  reported as a within-window configuration segment.
- **CLI wrappers add their own scaffolding** around the prompt. The runner
  uses the most direct non-interactive mode each CLI offers and validates
  strict JSON output; parse failures follow the existing retry/terminal
  rules.
- These limitations make the subscription configuration weaker as a frozen
  scientific instrument than a pinned API configuration. The owner accepts
  this trade to make the validation window financially possible; the
  superseding protocol and the eventual methods write-up must disclose it.

## 5. Cost

Marginal cost: $0 (subscription capacity already paid; volume is trivial
against plan limits). The unapproved later human-coding budget
(APR-D126, ~$45k baseline pending the timing pilot) is untouched by this
resolution and remains a separate future decision.

## 6. Decision requested

1. Approve this direction (owner).
2. Confirm the Mac-on-daily and daily-review commitments (owner).
3. Implementation then proceeds as agent work: CLI voter adapters, new
   method version + runtime contract, protocol v2 supersession, launchd
   runner, monitoring, then the PUL-043 → PUL-040 chain under the already
   prepared packets — with the paid-API path left disabled.

## Approval record

Owner decision: **approved** — "you have my go ahead," given in writing in
the working session against this document's stated design and commitments
(Mac on daily; daily review queue). The voter panel is the owner's explicit
model selection: GPT 5.6 Terra (CLI model id gpt-5.6-terra) (Codex), Claude Sonnet 5 (Claude Code),
Kimi K3 (Kimi CLI), Grok 4.5 (Grok CLI).

Paid-API authority: **none granted.** The paid classifier path remains
disabled; its hard USD cap is $0. This resolution is the written
provider/model and volume authority the Pulse wave required, in
subscription-only form.

Date: **2026-08-17**
