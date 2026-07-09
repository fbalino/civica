# Project Memory Preferences

- **Credit-aware orchestration (owner, 2026-07-09):** default to the primary
  Codex session for implementation and verification. Do not spawn Sol-class
  Codex subagents for routine work. Luna/Terra are acceptable only for bounded,
  low-context lanes when model selection is actually enforceable; otherwise
  stay local. Fable 5 is the key decision-maker for consequential design
  choices. Use Claude Sonnet/Opus for bounded routine Claude work. No paid API
  fallback without explicit approval and a hard cap.
- THE WHOLE DESIGN SYSTEM IS A CLOSED SET (owner, escalated 2026-07-05: "We
  NEVER hard code, EVER... it's a waste of tokens because we have to redo
  everything"). Applies to every visual decision, not just layouts: colors,
  type, spacing, controls, tooltips, tables. Missing capability ⇒ add a
  design-system component/token FIRST, then use it. Enforced mechanically by
  `npm run validate:design-tokens` (baseline ratchet) — run it before every
  UI commit; agent briefs must require it.
- LAYOUT SHELLS ARE A CLOSED SET (owner, restated with frustration 2026-07-04
  after /privacy + /terms shipped as bare narrow columns): every new page MUST
  use a documented layout row from DESIGN.md's "Picking the layout" table.
  Sectioned document pages (legal, policy, reference) take `methodology-layout`
  + `ReaderSidebar` (1200px, left sidebar) — `width="narrow"` is for blog-style
  essays only. Never invent a page width or one-off look; if no row fits,
  extend the table first. When delegating UI to subagents, the brief must name
  the exact layout row — "reader page" without the shell name causes drift.
- Prefer simple explanations because the user is non-technical.
- When possible, verify visual changes locally before handing back URLs.
- Keep Civica Index and atlas concerns separated clearly in routing and UI copy.
- Mockups location (as of 05-14-2026, CIV-208): all new PM mockups go in
  `/Users/fernandobalino/Projects/civica/mockups`. Filenames MUST be prefixed
  with the creation date in `MM-DD-YYYY-` format, e.g.
  `05-14-2026-election-timeline.html`. Existing pre-CIV-208 mockups in that
  folder are not renamed retroactively — the convention applies "from now on".
- No "before/after" framing in docs, methodology prose, or commit messages.
  Civica is pre-launch with NO users — it's beta testing / building, so there
  is no "before" to remediate. Write specs, methodology, and changelogs as
  forward-looking current/target-state design ("the build adds X", "X works
  like Y"), not as "X was wrong, now fixed". (Owner restated this 2026-06-21.)
- Don't offer to /schedule a background agent for follow-up work that another
  active workstream is already going to do. Multiple agents on Civica run in
  parallel at agent velocity (F.2.1 took ~1 hour end-to-end), so "check
  back in 2 weeks" pacing is wrong for cross-workstream coordination —
  the parallel agent will notify when ready. Reserve schedule offers for
  genuine calendar-gated follow-ups (T+N quarterly vintage, soak windows,
  external-review return).
