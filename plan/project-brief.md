# Project Brief

## Project

- **Name:** Civica Academic Publication Readiness
- **Absolute root:** /Users/fernandobalino/Projects/civica
- **New or existing:** Existing production Next.js application and research-data system
- **Primary goal:** Make Civica Atlas the trusted provenance-first comparative reference to how every country is governed, while validating or redesigning the Civica Index and rebuilding Pulse as an academically defensible experimental event system before human review and outreach.
- **Target audience:** Comparative-politics researchers and teachers, research-data librarians, data journalists, governance NGOs, students, and civically curious readers
- **Business value / stakes:** Civica must earn trust as a citable reference without overstating experimental measurements or source rights; methodological and provenance errors would damage the project's academic standing

## User request

Create an exhaustive, repository-grounded master plan that makes Civica Atlas the trusted provenance-first comparative reference to how every country is governed. Keep original measurement products secondary and experimental: validate or creatively redesign the Civica Index, rebuild Pulse as an event ledger before reconsidering a score, remove judgmental A–F grading, correct every inaccurate public document, normalize the visual system and art corpus, complete agent-verifiable work before external review, then prepare a rigorous human-review and outreach program including the advisory-board route and reviewer discovery.

## Existing materials

- Brand assets: Civica Atlas identity and engraving corpus under `public/`; canonical design language in `DESIGN.md` and `/design-system`
- Copy/content: Reader prose under `content/*.md`; methodology pages, Record articles, licensing, citation metadata, API docs, and advisory-board content in the repository
- Reference sites: Current production site at `https://civicaatlas.org`; primary methodological peers and source institutions documented in the master plan
- Existing code/project: Next.js 16.2, React 19.2, Neon/Postgres, Drizzle, 49-table schema, substantial ingestion/reconciliation/Index/Pulse pipelines, tests, APIs, embeds, cron jobs, and admin review tools
- Existing MCP-dependent workflows: Claude Code subscription worker for a bounded Fable Index design-space study; Codex subagents for blind read-only audit lanes; browser QA for later execution

## Constraints

- Prefer subscription authentication; paid API requires explicit approval and a hard cap.
- Use autonomous workers only inside trusted project scope.
- Keep one writer per mutable file area.
- Keep planning and operational state inside this project.
- The design system is a closed set: add or amend canonical tokens/components and `/design-system` before page-local UI work.
- Preserve source provenance and stamp freshness only through `markSourcesSynced()` after rows are actually written.
- Do not activate paid model APIs without a new explicit approval and USD cap.
- Default to the primary Codex session; do not spawn Sol-class subagents for
  routine work. Use Luna/Terra only when model selection is enforceable and the
  lane is bounded. Reserve Fable 5 for consequential design decisions and use
  Claude Sonnet/Opus for bounded routine Claude work.
- Do not treat agent agreement as academic validation; external human review remains the final pre-publication gate after agent-completable work.

## Worker plan

| Lane | Worker/model | Owns | May run in parallel? |
|---|---|---|---|
| Academic/product design | Claude Code / Fable (subscription) | `plan/research/fable-index-design-space-2026-07-09.md` only | Yes |
| Blind academic audit | Codex subagent | Read-only findings returned to controller | Yes |
| Blind platform audit | Codex subagent | Read-only findings returned to controller | Yes |
| Blind experience audit | Codex subagent | Read-only findings returned to controller | Yes |
| Master-plan synthesis | Primary Codex controller | New master-plan files and project state | After audit findings |
| Implementation | Future scoped Codex lanes | Assigned task files only | Per dependency map |
| Images | Future Codex image/offline-processing lane | Approved pilot/manifest destinations only | After EXP-005/006 contract and owner approval |
| Video | Out of scope for the readiness plan | None | No |
| QA | Primary Codex + independent read-only verifier | Tests/browser/evidence, not implementation files | After each lane and at gates |

## Acceptance criteria

- [x] A current-state audit distinguishes shipped, experimental, contradictory, stubbed, and missing work with file/data evidence.
- [x] Every task in the master plan has a stable ID, priority, dependency where needed, and an objective `Done when` test.
- [x] The master checklist exactly matches all area task files and establishes trustworthy progress reporting.
- [x] Index and Pulse each have fair validation gates that permit redesign, demotion, or retirement.
- [x] Academic release, external review, advisory-board recruitment, reviewer discovery, brand/legal, and outreach work begins only after explicit readiness gates.
- [x] No existing user plan or artifact is overwritten or silently discarded.

## Decisions requiring the user

- Whether any future Index candidate clears the predeclared validation tournament; no candidate is guaranteed to survive.
- Whether a brand rename is warranted after trademark/confusion research and professional legal review.
- Final approval of external reviewers, outreach messages, and any public launch date.
