# Voter-dropout counter — 2026-08-18

Added at the owner's request after the Kimi content-filter diagnosis
(`kimi-content-filter-2026-08-17.md`).

## Why

A provider that refuses governance evidence on content-policy grounds does
not fail at random. It fails hardest on the most severe events, so a panel
that silently loses that voter gets weaker exactly where the news is worst.
That is content-correlated missingness, and it is the kind of bias the
prospective evaluation must be able to measure rather than assume away.

## What it records

Every classify stage run tallies voter dropouts, keyed:

- `voter.<provider>.<kind>` — total dropouts, where `kind` is one of
  `content_filter`, `timeout`, `startup`, `empty_output`, `exit`, `parse`,
  `unknown`.
- `voter.<provider>.<kind>.severity.<outcome>` — the same dropout paired with
  the outcome the *surviving* voters agreed on: a severity tier
  (`catastrophic_neg` … `high_pos`), or `none`, `deadlock`,
  `invalid_category`, `panel_failed`.

`content_filter` is deliberately separated from ordinary failures. The
detection runs only over a failed call's summarized stderr — never over model
output — so a model reasoning about a risky event cannot be mistaken for a
refusal. Signatures are vendor-neutral; extend the list rather than widening
a pattern, so an ordinary failure is never miscounted as a refusal.

Counts persist in `pulse_pipeline_runs.counts` (the existing flat numeric
map) and surface in the classify CLI summary.

## Verification

- `voter-failure-tally.test.ts` (3 tests): per-provider tallying, severity
  pairing, per-run reset, and no-dropout silence.
- `subscription-cli.test.ts`: the exact Moonshot refusal string plus
  vendor-neutral phrasings classify as `content_filter`; timeout, startup,
  empty-output and exit failures do not; and "the protest carried a high risk
  of escalation" (a model reasoning about risk) classifies as `unknown`.
- End-to-end on the real pipeline with a stubbed refusing `kimi` on PATH:
  `provider_call_failed moonshot/kimi-k3 (content_filter)`, CLI summary
  `moonshot.content_filter 1 [none=1]`, and the persisted run counts
  `voter.moonshot.content_filter: 1`,
  `voter.moonshot.content_filter.severity.none: 1`.
- A real four-voter run with no failures records nothing.
- 299/299 pulse tests, typecheck, runtime-method and v60 contract validators.

No paid API was used. The counter changes no classification behavior: a
dropped voter already degraded the panel, blocked "all" agreement, and routed
to human review.
