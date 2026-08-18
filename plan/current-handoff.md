# Current handoff — Civica

**Updated:** 2026-08-18 (subscription-runtime wave closed; two items parked on
data and one owner decision)
**Current objective:** none in flight. The Pulse daily machine runs itself.
Two checklist items wait on accumulation and one small owner call.

## Verified state

- Branch `main`, pushed and clean (`52679084`). The home-nav/Explore
  simplification (`a8f58bcc`, PR #24) and its doc fallout are merged and
  reconciled; PR #25 and this commit closed the follow-ups.
- **$0 enforcement is live and verified twice in production:** the owner
  removed the three classifier API keys, and the scheduled classify route
  refuses any paid transport (`paid_transport_locked`). The Vercel cron
  feature toggle is ON; every scheduled stage is model-free.
- **The four-voter subscription panel works on live data.** Proven
  2026-08-18: a real cluster classified with openai/anthropic/moonshot/xai
  runs stored, `classifier_agreement = all`, `published = false`,
  `review_status = pending`. $0 marginal cost.
- Runtime method `pulse-v2.16-beta`; `pulse-validation-protocol/v2`
  supersedes v1 pre-start with v1 preserved and hash-pinned. The daily
  launchd job (`org.civicaatlas.pulse-daily`, 09:30 local, catch-up on wake)
  is installed and has completed real cycles.
- Gates green on this commit: 9/9 explore e2e, exp-017/exp-024/qa-016,
  typecheck, design tokens, index change control, the v60 subscription-runtime
  contract validator, and the full `validate:claims-docs` aggregate.

## The two open items — neither is blocked on engineering

1. **PUL-024 (drift baseline) — waiting on data.** The baseline needs 100
   retained model-version rows; the database had ~12 at the cut. The daily
   runner accumulates them. When
   `npm run capture:pulse-drift-baseline` stops saying NOT ELIGIBLE, run it
   with `--write`, let one scheduled monitoring outcome record, then check
   PUL-024.
2. **PUL-040 (90-day clock) — waiting on one owner decision.** The
   preregistered prerequisite wants a `completed` run for each automatic
   stage. Ingest cannot reach `completed` because Amnesty's feed WAF-blocks
   every request (verified 403 across three user agents), so ingest honestly
   records `partial` every day. Two legitimate paths, owner's choice:
   retire Amnesty to `inactive` alongside ACLED/RSF/Reuters (it genuinely is
   unavailable), or rule that an honest `partial` with per-connector failure
   recording satisfies "a successful run of the stage". **Do not loosen the
   preregistered rule unilaterally to make the gate turn green.** A
   review-SLA run under v2.16 is also still needed; its manual POST is
   rejected, so the 6-hourly schedule supplies it.

Also queued for the owner in `plan/MANUAL-CHECKS.md`: whether the Kimi
voter's system-channel prompt delivery needs its own runtime-method note
(APR-D147). Substance is already covered by resolution §4; the resolution
text itself is hash-pinned, so any amendment must ride with that decision's
change-control record.

## Known, recorded, not blocking

- The 2026-08-17 cycles classified 26 clusters on a degraded 3-voter panel
  (Kimi failing). Honest historical evidence, settled in the PUL-032 state
  machine, entirely pre-window. Re-running is a separate decision.
- Headless Kimi calls load the owner's MCP servers (~30 s/call overhead);
  `~/.kimi-code/mcp.json`, outside this repo.
- Dead code left deliberately: ~160 lines of `.explore-concept*` CSS in
  `design-system.css`, `continent?` in `CountryDirectoryEntry`, and 16
  orphaned `explore-*.webp` navigation engravings. Deleting the engravings is
  a manifest cascade — see the inventory in this session's review before
  touching them.
- `e2e/visual-baselines/candidate-manifest.json` hashes are stale for home,
  home-explore-menu, and design-system. No gate reads it.
- **Operational gotcha, cost hours tonight:** a stale `.next` made the e2e
  suite test a build with no Explore section at all, producing four
  convincing false failures. If e2e results contradict the source, kill the
  dev servers, `rm -rf .next`, restart, and re-run before believing them.

## Boundaries

- No paid classifier transport, ever, without new written owner authority.
  Do not weaken the route lock or PUL-036's always-queue rule.
- Never rewrite `data/research/pulse-validation-protocol-v1.json` or retained
  v2.15 artifacts. Rewrite this handoff at the next milestone.
