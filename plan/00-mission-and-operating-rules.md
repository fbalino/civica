# Civica Academic Publication Readiness — Mission and Operating Rules

**Status:** Active master-plan contract
**Established:** 2026-07-09
**Owner:** Fernando Balino
**Controller:** Codex
**Canonical checklist:** `plan/MASTER-CHECKLIST.md`

## Mission

Make **Civica Atlas the trusted, provenance-first comparative reference to how every country is governed**. The atlas and its inspectable source trail are the primary product. Original measurements are secondary experiments that must pass declared validation gates before they receive strong public claims.

This effort is done when Civica can publish a frozen, reproducible, properly licensed and cited atlas release; every public factual and methodological claim matches the implementation and data; the Index has survived, changed, or been retired through a fair validation tournament; Pulse works first as a versioned event ledger and only regains numeric scoring if prospective validation supports it; automated and browser verification covers the critical reader and data paths; external reviewers can reproduce and critique the work from a complete review packet; and a staged outreach program can begin without overstating Civica's standing.

## Product hierarchy

1. **Primary — trusted reference atlas.** Countries, institutions, constitutions, elections, parties, organizations, indicator histories, source provenance, reconciliation, exports, and citation.
2. **Secondary — research experiments.** Index candidates, Pulse classification and any future numeric signals. Experimental status must be visible in UI, API, metadata, exports, and prose.
3. **Supporting — publication and distribution.** Record articles, API/docs, embeds, research notes, teaching assets, advisory-board recruitment, reviewer packets, and outreach.

## Non-negotiable gates

| Gate | Meaning | Pass condition |
|---|---|---|
| G0 — Plan integrity | The work can be executed without drift. | Master/area task IDs match; every task has priority and objective `Done when`; decisions and manual checks exist. |
| G1 — Truthful beta | Public claims no longer outrun evidence. | Claims ledger has zero unresolved P0 contradictions; A–F country grading is absent from live UI/API/prose; experimental products are consistently labelled. |
| G2 — Reproducible atlas RC | The primary product can be independently rebuilt and cited. | A clean environment reproduces the frozen release, checksums, coverage report, codebook, rights manifest, and citation metadata. |
| G3 — Measurement decisions | Index and Pulse have evidence-backed dispositions. | Index tournament resolution and Pulse ledger/numeric-signal resolution are published with results and retirement rules. |
| G4 — Agent-complete candidate | Agent-verifiable work is effectively complete before outside review. | All P0/P1 agent-verifiable tasks are checked; required tests/build/browser matrices pass; open items are only explicit human/external checks or P2 work. |
| G5 — External review resolved | Qualified humans have reviewed the release candidate. | Independent reports, author responses, revisions, conflicts, and remaining disagreements are published or archived. |
| G6 — Public release and outreach | Civica can make bounded, supportable claims to target audiences. | DOI release and launch package are live; outreach is approved; monitoring and correction paths are operating. |

No external-review solicitation begins before G4 except quiet reviewer-market research that does not contact people. No broad marketing begins before G5.

## Verification surfaces

### Required automated checks for relevant tasks

- Unit/integration tests: `npm test`
- Live read-only database tests: `npm run test:db`
- Content-template truth checks: `npm run validate:content-templates`
- Source-freshness enforcement: `npm run validate:sync-freshness`
- Design-system ratchet: `npm run validate:design-tokens`
- Lint: `npm run lint`
- Production build: `npm run build`
- Browser/e2e suite: the task is incomplete until the plan adds a canonical command and it passes for the affected flow
- Master-plan integrity: `node plan/tools/validate-master-plan.mjs`

Run the smallest relevant checks during implementation and the full release matrix at G2, G4, G5, and G6. A command that exits zero while running zero applicable tests is not evidence.

### Required browser checks for UI tasks

- Exercise the real route locally before sharing any URL.
- Test light and dark themes, desktop and mobile, keyboard-only navigation, loading/empty/error/success states, console errors, failed requests, image loading, and relevant reduced-motion behavior.
- Save named screenshots and the browser-check log under `plan/evidence/<TASK-ID>/`.
- UI work is not complete because a component renders in isolation; the affected real route must pass.

### Manual or external checks

Anything an agent cannot prove—professional legal advice, reviewer independence, real email delivery, expert construct judgment, external registry acceptance, or subjective art approval—goes into `plan/MANUAL-CHECKS.md`. Implement all preparatory work, append the exact check, and continue. Never mark the parent task complete by pretending an external result occurred.

## Task execution contract

For each unchecked task in dependency order:

1. Read its area file, dependencies, and `Done when` clause.
2. Confirm no other worker owns the same mutable files.
3. Implement the smallest complete change.
4. Verify with named commands and real-route browser checks where applicable.
5. Store proof under `plan/evidence/<TASK-ID>/`.
6. Check the task in both its area file and `plan/MASTER-CHECKLIST.md`.
7. Append one plain-language line to `plan/PROGRESS.md` with the evidence path.
8. Update `plan/DECISIONS.md` only when a durable choice was actually made.
9. Commit only the scoped task files and evidence with a clear message.

One mutable file area has one driver at a time. Parallel read-only audits are allowed. Parallel write lanes require disjoint ownership and an explicit merge order.

## Evidence standard

Worker reports are claims. Evidence is the diff plus tests, queries, generated artifacts, and browser results independently inspected by the controller. Each evidence folder should contain a short `README.md` naming:

- task ID and commit;
- commands actually run and exit status;
- datasets/vintages or fixtures used;
- screenshots or output artifacts;
- remaining limitations;
- manual checks queued, if any.

Do not commit secrets, raw licensed datasets that cannot be redistributed, production dumps, user data, build artifacts, or model credentials. Store hashes/manifests and access instructions when raw inputs cannot be included.

## Academic and data guardrails

- A public empirical claim requires a construct definition, unit, vintage, source, transformation, uncertainty posture, missing-data rule, version, and falsification or correction path.
- Agent agreement is not academic validation. Agent work may find and repair defects, generate candidate designs, run analyses, and prepare review artifacts; qualified independent humans remain the final review gate.
- Predeclare validation thresholds before computing winner-selecting results. Keep simple baselines in every tournament. A valid outcome is that no original candidate wins.
- Never label a heuristic simulation interval a confidence interval for a true latent score unless the statistical model supports that interpretation.
- Never collapse “no event observed” into “stable” or “no governance change” without an explicit observability model.
- Preserve rejected, null, and negative evidence needed to estimate false positives and false negatives.
- Source freshness is stamped only through `markSourcesSynced()` after a non-dry run actually writes rows.
- Every frozen release records code commit, input vintages/hashes, transformation version, schema version, generated-at time, and rights posture.
- Non-commercial source restrictions are release gates for any future monetization.

## Documentation truth rule

Public methodology, UI labels, API docs, examples, README, citation metadata, structured metadata, data exports, comments that function as operational instructions, and project memory must change in the same task as the behavior they describe. A task that changes methodology without updating every registered public surface is incomplete. Automated claim/route/template validators should enforce what can be enforced mechanically.

## Design and asset guardrails

- `DESIGN.md`, design tokens, shared primitives, and `/design-system` are canonical and form a closed set.
- When a visual capability is missing, add the token/component/pattern to the system first; never create a page-local approximation.
- Run `npm run validate:design-tokens` for every UI task and ratchet the legacy baseline downward, never upward.
- Country/page art is editorial illustration, not documentary evidence. Retain generation/edit manifests, model/tool disclosure, prompt or transformation provenance, captions, rights, and QA results.
- Asset-wide changes start with a representative pilot and objective thresholds; do not batch 197 images before the pilot is approved.
- Navigation redesign begins with three structural concepts before any replacement art is generated.

## Model and automation guardrails

- Prefer existing Codex/ChatGPT and Claude subscription authentication.
- Keep routine implementation and verification in the primary Codex session.
  Do not spawn Sol-class subagents for ordinary work. Use Luna/Terra only when
  model choice is enforceable and a bounded low-context lane materially helps.
- Fable 5 is the key decision-maker for consequential visual/product design;
  use Claude Sonnet/Opus for bounded routine Claude critique or research.
- Paid model APIs require explicit project-specific approval, a provider/model, and a hard USD cap recorded in `.orchestrator/state.json`.
- Keep automatic review loops to one independent review and one focused repair pass unless a concrete failure remains.
- Store orchestration state and worker artifacts in this repository; do not place project history in global skill or memory files.

## Plan self-extension

Executors may and should add tasks when implementation exposes a bug, missing state, invalid assumption, new source-rights issue, or untested edge. New tasks receive the next stable ID in the correct area, an objective `Done when`, dependencies, and a matching line in `plan/MASTER-CHECKLIST.md`. Discovered work is never buried in prose or silently folded into an unrelated task.

Existing dated plans remain historical evidence and are not deleted. Their unfinished, still-relevant work must be imported into this checklist before execution; superseded items receive a decision record rather than disappearing.

## Autonomous kickoff prompt

> Work `plan/MASTER-CHECKLIST.md` in dependency order. For each unchecked task: implement the smallest complete change; verify its exact `Done when` with real commands, read-only data checks, and browser QA where applicable; save proof under `plan/evidence/<ID>/`; tick the task in the master and its area file; log one plain-language line in `plan/PROGRESS.md`; and make a scoped commit. Add new stable-ID tasks whenever work is discovered. Never fake an external/manual result—queue it in `plan/MANUAL-CHECKS.md`. Preserve the atlas-first product hierarchy, the design system, source-rights constraints, and subscription-only model policy. Stop only for a decision that would materially change the approved product direction or require new external authority.
