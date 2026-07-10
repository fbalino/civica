# CLM-016 evidence — research publication policies

## Outcome

Civica now publishes one canonical `/policies` document covering corrections, clarifications, no-change reviews, rejection, retraction, supersession, methodology/version changes, known-limitations disclosure, API/data corrections, historical preservation, and notification. It is explicitly a pre-launch, single-maintainer policy: response times are best-effort targets, private submissions do not appear in the public log, and the site does not claim an automated publication job, frozen public archive, versioned historical API, or email/subscriber notification system that does not exist.

Six research artifacts form a closed typed registry: Civica Index, Pulse ledger, reconciliation, peer grouping, PCA appendix, and Civica Conditions. Each canonical artifact surface links its required policy anchors, and the policy links back to the artifact-specific methodology or limitation disclosure.

## Executable contract

- `content/policies.md` — canonical public prose
- `src/app/(reader)/policies/page.tsx` — methodology-layout shell and policy metadata
- `src/lib/policy/research-artifacts.ts` — six-artifact closed registry and policy version
- `src/lib/policy/correction-simulator.ts` — pure correction/retraction/clarification record generator
- `src/lib/policy/policy-surface.ts` — fail-closed invariants and overpromise/current-boundary scanners
- `scripts/validate-policy-surface.ts` — DB/network-free build guard
- `src/lib/policy/__tests__/` — 21 simulator and adversarial policy fixtures

The frozen correction fixture produces exact changelog, supersession-marker, and release-note objects. Retraction produces a tombstone with no successor; clarification produces neither a supersession marker nor a release note.

## Verification

- focused policy/simulator fixtures: **21/21**
- full suite: **311/311**
- `npm run validate:policy-surface`: pass; six registered artifacts, eight link-only mirrors
- public claims: 36 claims, 14/14 required surfaces, 40 markers, zero authority/grade/unregistered leaks
- content templates, documentation routes/anchors, terminology, API contracts, metadata, replication, freshness, TypeScript, targeted ESLint, design tokens, and diff checks: pass
- production build: pass; 86 static pages, with only the known pre-existing Turbopack broad-trace warning
- production browser: desktop light and mobile dark, no horizontal overflow, fresh deep links clear the sticky header, artifact/policy links render, and correction targets are visibly best-effort; see `browser-checks.md`

## Independent work and review

- `SN5 CLM-016 policy inventory` — Claude Sonnet 5, bounded repository inventory; primary Codex corrected two inventory errors before implementation
- `OP48 CLM-016 policy contract` — Claude Opus 4.8, binding publication-policy and acceptance architecture
- `SN5 CLM-016 policy implementation` — Claude Sonnet 5, substantial partial implementation; stopped after the lane ceased making progress, then audited and truth-hardened by primary Codex
- Primary Codex — capability-boundary corrections, privacy/notification wording repair, shared anchor-offset fix, build/browser QA, evidence, and closure
- `OP48 CLM-016 final acceptance` — Claude Opus 4.8: **ACCEPT, no blockers**

## Deliberate boundary

CLM-016 publishes and enforces the policy contract; it does not pretend the simulator is production automation. Frozen release archives, versioned historical API retrieval, database-level supersession pointers, DOI deposits, subscriber feeds, and clean-room reproduction remain owned by later data, release, and governance gates.
