# SN5 CLM-016 bounded implementation

Project root: `/Users/fernandobalino/Projects/civica`

Role: single implementation writer for CLM-016.

Read first:

- `AGENTS.md`
- `DESIGN.md`
- `plan/evidence/CLM-016/op48-policy-contract.md` (binding contract)
- `plan/evidence/CLM-016/sn5-policy-surface-inventory.md` (inventory only; note that its claim that Index lacks a limitations section is wrong — `content/methodology-civica-index.md` already has `#limitations`)

Implement the smallest complete contract. No schema migration, production DB write, email/subscriber feature, API response-shape change, or prelaunch migration narrative.

Required architecture:

1. Canonical public route `/policies`, using `methodology-layout`, `ReaderSidebar`, `MarkdownContent`, existing editorial classes, and no new CSS/per-page styles. Authored prose lives at `content/policies.md`; all SLA/version values interpolate from existing typed state, never hardcoded in prose.
2. A typed closed registry for exactly these six public research artifacts and their canonical source files:
   - Civica Index — `/civica-index` — `src/app/(reader)/civica-index/page.tsx`
   - Pulse ledger — `/civica-index/pulse-changelog` — `src/app/(reader)/civica-index/pulse-changelog/page.tsx`
   - Reconciliation — `/country/methodology/reconciliation` — `src/app/(reader)/country/methodology/reconciliation/page.tsx`
   - Peer grouping — `/civica-index/methodology/peer-grouping` — `src/app/(reader)/civica-index/methodology/peer-grouping/page.tsx`
   - PCA appendix — `/civica-index/methodology/pca-appendix` — `src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx`
   - Civica Conditions — `/civica-conditions` — `src/app/civica-conditions/page.tsx`
   Each must link directly to its required `/policies#...` anchors. Add links to existing footer-nav areas when present; otherwise use a small shared component composed only from existing `.editorial-footer-nav` styles. Do not redesign pages.
3. Add `/policies` to the Research footer column, methodology hub, sitemap, README template (then regenerate README with the sanctioned script), and the existing corrections intake page as the governing policy. These are link-only mirrors.
4. The policy must define correction, clarification, no-change, rejected, retraction, supersession, and methodology/version change; Critical/Major/Minor/Editorial policy severity distinct from reconciliation numeric severity; best-effort calendar-day targets from `disputeSla`; historical preservation; current pre-G2/live-state limitations; API/data correction behavior; notification through public logs only; version increment rules; and artifact-specific known-limitations links. It must explicitly disclose that there is no automated email/subscriber/push notification and no versioned historical API endpoint today.
5. Register four `institutional-posture` public claims and a CLM-016 documentation concept with link-only/interpolated relations.
6. Implement a pure, DB/network/clock-free correction simulator with frozen correction, retraction, and clarification fixtures. The correction fixture must deep-equal the Opus contract's changelog, supersession marker, and release-note objects. Clarification emits no supersession or release note; retraction has no successor and is visibly retracted.
7. Implement a pure policy-surface validator + focused tests + `scripts/validate-policy-surface.ts`. It must fail on missing anchors, incomplete/duplicate artifact registry, missing reciprocal artifact links, overpromised staffing/notification, hardcoded SLA/version prose, migration theater, and simulator drift, while permitting ordinary correction/limitation vocabulary and honest negations. Wire `validate:policy-surface` into `npm run build` after terminology.
8. Add `content/policies.md` explicitly to `CTX_ALLOWLIST` with no `ctx.*` helpers and ensure the page passes content templating even without a database.

Suggested owned files (you may add one narrowly necessary shared component):

- `content/policies.md`
- `src/app/(reader)/policies/page.tsx`
- `src/lib/policy/research-artifacts.ts`
- `src/lib/policy/correction-simulator.ts`
- `src/lib/policy/policy-surface.ts`
- focused test files under `src/lib/policy/`
- `scripts/validate-policy-surface.ts`
- the six registered artifact page files (link-only)
- `src/components/SiteFooter.tsx`
- `src/app/(reader)/methodology/page.tsx`
- `src/app/(reader)/civica-index/corrections/page.tsx`
- `src/app/sitemap.ts`
- `README.template.md` and generated `README.md`
- `scripts/validate-content-templates.ts`
- `src/lib/claims/public-claims.ts`
- `src/lib/docs/doc-concepts.ts`
- `package.json`

Forbidden files/actions:

- Do not edit any checklist, progress, decision, memory, or orchestrator-state file.
- Do not edit other untracked `plan/` artifacts or your evidence prompts/contracts.
- Do not add a database table/column/migration or change API payloads.
- Do not run a browser or dev server.
- Do not commit.

Acceptance before returning:

- focused policy tests pass;
- `npm run validate:policy-surface`, `validate:content-templates`, `validate:doc-sources`, `validate:public-claims`, `validate:terminology`, `validate:design-tokens`, typecheck, targeted ESLint, and `git diff --check` pass;
- report every changed file and any remaining blocker honestly.

Expected worker-result envelope: normal structured result with status, concise summary, changed files, commands actually run, verification, needs_user, and next action. Do not create a separate implementation report.
