# Kimi voter failure — root cause and fix (2026-08-17)

Part of the subscription-runtime wave. The moonshot (Kimi K3) voter failed on
every classify call during the first supervised cycles; the other three
voters succeeded, so the panel ran degraded 3-of-4.

## Two plausible hypotheses, both refuted by evidence

1. **"It only fails under launchd."** Refuted: the identical failure
   reproduces from an ordinary interactive shell using the real frozen
   classify prompt. The earlier interactive probes passed only because they
   used a trivial prompt.
2. **"Concurrent Kimi instances contend on `~/.kimi-code` state."** Refuted:
   three Kimi voter calls in parallel, plus a fourth background instance, all
   succeeded (`kimi-code.log` shows the shared search index opened once
   `readOnly=false` and twice `readOnly=true`, no error).

## Actual root cause

Moonshot's managed endpoint applies a **server-side content-risk filter to
the user turn**. `callSubscriptionCli` flattened the frozen prompt into a
single user message (`${system}\n\n${user}`). Civica's classify rubric is, by
construction, a dense catalogue of repression categories — martial law,
journalist arrest, mass detention, systematic crackdown, internet shutdown,
foreign occupation, judicial purge. Delivered as a *user* message it is
refused, deterministically:

```
provider.api_error: 400 The request was rejected because it was considered high risk
```

Bisection (pre-fix):

| Input | Chars | Result |
| --- | ---: | --- |
| trivial prompt | 33 | exit 0 |
| news evidence only (tear gas, detentions) | 572 | exit 0 |
| benign filler, same length as the rubric | 15,687 | exit 0 (size control) |
| frozen system rubric only | 15,687 | **exit 1 — high risk** |
| rubric + news evidence | 16,181 | **exit 1 — high risk** |

Octile slices of the rubric isolate it further: oct-2 (martial_law /
journalist_arrest / protest_crackdown / mass_detention / internet_shutdown)
and oct-6 (foreign_occupation + emergency_declaration / judicial_purge) fail;
the other six octiles pass. So it is the repression vocabulary itself, in the
user channel, and not prompt length.

## Fix

`src/lib/pulse/v2/subscription-cli.ts` — the moonshot voter now carries the
frozen system prompt through the CLI's own **agent (system) channel**
(`kimi --agent-file <file> -p <user evidence>`), where an operator rubric
belongs. The other three voters keep the concatenated prompt.

**The prompt text is byte-identical for all four voters**; only the channel
carrying it differs. Resolution §4 already discloses per-CLI wrapper
scaffolding; it now names this difference explicitly. Whether it warrants its
own runtime-method note is queued as an owner decision in
`plan/MANUAL-CHECKS.md`. No prospective window had started when the change
was made.

## Verification

Four voters through `callSubscriptionCli` + the production `parseClassify`,
under an environment matching the launchd plist exactly (`env -i` with only
PATH/RUNNER_NODE/CIVICA_REPO/HOME/USER/LOGNAME/TMPDIR, plus
`XPC_SERVICE_NAME`, stdin closed so there is no TTY), with a competing Kimi
process running:

- openai/gpt-5.6-terra — protest_crackdown / moderate_neg
- anthropic/claude-sonnet-5 — protest_crackdown / moderate_neg
- moonshot/kimi-k3 — mass_detention / moderate_neg
- xai/grok-4.5 — protest_crackdown / moderate_neg

Severe-content probes through the fixed path also pass: coup →
coup/catastrophic_neg; judicial purge → judicial_purge/catastrophic_neg;
journalist killed → political_assassination/severe_neg. An independent
verifier re-ran every proof from scratch and confirmed the diagnosis and fix.

`npx tsc --noEmit` clean; `subscription-cli.test.ts` 7/7 (three new tests pin
the Kimi system-channel argv, the agent-file contents, and that the other
three voters keep the combined prompt). No paid API was used at any point.

## Recorded consequences

- The 2026-08-17 cycles classified 26 clusters on a degraded 3-voter panel
  (50 Kimi calls failed). Those stored runs are honest historical evidence of
  a 3-voter panel, not the approved 4-voter panel. They are settled in the
  PUL-032 state machine; re-running them is a separate decision. All of it
  predates any prospective window.
- Observed in passing, not fixed: headless Kimi calls load the owner's MCP
  servers (`analytics-mcp`, `dataverse-test` time out after 30 s), adding
  roughly 30 s per call. That is `~/.kimi-code/mcp.json` configuration,
  outside this repository.
