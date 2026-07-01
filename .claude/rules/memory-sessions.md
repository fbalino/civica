# Project Memory Sessions — Durable Learnings

Per the three-bucket rule (memory-docs-hygiene): this file holds ONLY durable,
non-git-recoverable gotchas and constraints. Per-feature "what shipped" history
lives in git (`git log`) and `~/civica/plan/*` — NOT here. Do not add changelogs.

## Current architecture state
- **Reader-first (Option B, 2026-06-30).** The three-pane `(shell)` route group is
  GONE; pages are full-width reader pages under `(reader)`. KEPT: `src/lib/shell/events.ts`
  (the `civica:ask` window-event bus — still used by the factbook CivicaAIDrawer / bills /
  atlas) and `src/app/shell.css` (`.atlas-resizer`, used by `/compare`). Atlas is one
  self-contained `/atlas` map page. Redirects in `next.config.ts` (308):
  `/atlas/:slug(/:tab)`→`/factbook/:slug`, `/atlas/compare`→`/compare`,
  `/atlas/organizations*`→`/organizations*`.
- **Country page IA (Wave 1b, 2026-06-30):** the canonical country page is **`/country/[slug]`** — a
  3-tab page. Shared `country/[slug]/layout.tsx` = masthead (`FactbookHeaderStrip`, which now takes an
  optional `nav` prop) + `CountryTabBar`. Tabs: **Factbook** (`/country/[slug]`, CIA sections,
  scroll+`FactbookSidebar`), **Civica Data** (`/country/[slug]/civica-data` — CI via the reusable
  `CivicaIndexPanel` + Government org chart + Legislature + Leaders + Bills + Organizations + Rankings,
  same scroll+sidebar), **Constitution** (`/country/[slug]/constitution` — the Constitution Explorer).
  The old `/factbook/[slug]`, `/civica-index/[slug]`, and `/countries/*` pages are DELETED and 308-redirect
  in (a negative-lookahead redirect keeps the `/civica-index` leaderboard + its sub-routes — methodology,
  widget, pulse-changelog, etc. — live). The landing `/factbook` was renamed `/country` ("Countries");
  nav label is "Countries". `CountrySwitcherChips` is gone. Engraving/`factbook.css`/`FactbookSection`
  etc. are still named "factbook" (CIA-source naming) — that's intentional, not a route.
- **Domain:** apex `civicaatlas.org` serves prod; `www`→apex (308). Canonical/sitemap/robots
  are apex.

## CSS / UI gotchas (would silently re-break)
- `.factbook-hero` (country masthead — max-width:1280px, display:grid) and
  `.factbook-landing-hero` (full-bleed) are DISTINCT classes. Do NOT merge — the landing
  once reused `.factbook-hero` and inherited the 1280px cap (white gap on wide screens).
- Heroes share the `--hero-height` token (`clamp(460px,44vw,640px)`); documented in DESIGN.md.
- Search fields = rounded RECTANGLE `var(--radius-lg)`, never a pill. `radius-full` is
  circular-controls-only.
- **Hydration:** any SVG built with `Math.cos/sin` must round coords to 2 decimals
  (`Math.round(n*100)/100`) so SSR (Node) and the browser serialize identical attrs. Bit
  `HemicycleCover` and `FactbookLegislatureChart`.
- **Motion** (`motion/react`): always `useReducedMotion` + a no-JS SSR fail-safe (SSR renders
  at full opacity; never ship `opacity:0` that only JS undoes) so content is never trapped
  invisible. No GSAP / marquees / scroll-pinning — wrong register for the almanac.
- `src/app/blog/[slug]/page.tsx` has NO runtime React import (only the global type namespace).
  Use named imports (`isValidElement`), not `React.isValidElement`.

## Blog / images
- Cover resolution = `resolvePostCover()` in `src/lib/blog.ts`: dedicated
  `public/blog/<slug>/cover.{webp,png}` → first inline-placeholder engraving → frontmatter
  `coverImage` → generated HemicycleCover. Used by BOTH the `/blog` index AND the article hero
  (and the `/blog/[slug]` "More from The Record" cards must use it too, not raw `coverImage`).
  `blog.ts` honors frontmatter `draft:true` (filtered out of the site).
- Inline article figures: the `blog/[slug]` blockquote renderer auto-upgrades each
  "Image placeholder" block to a `<figure>` once the caption-named file exists (re-runnable).
- On every Codex art drop: convert `public/blog/*/*.png` and
  `public/engravings/countries/*.png` → `.webp`, then deploy.

## Data / CI correctness invariants
- CI read queries MUST pin `methodology_version='beta'` (else a v1.0/beta mix → zig-zag
  history + double-counted gov-type averages).
- CI per-dimension scores go through `displayDimensionScore` (v2 fixed-bound normalize) so the
  breakdown reconciles with the headline — keep it consistent across the country page,
  `/api/v1/index`, `/api/v1/countries`, embed, and compare.
- Freedom House dimension: `normalize-v2` expects the **2–14 SUM** (avg×2), not the 1–7 avg.
- `SourceDot` treats ALL frozen academic/quarterly vintages (incl. `civica_curated`) as frozen
  (amber); green is reserved for genuinely live feeds.
- `sources.last_sync_at` is stamped ONLY via `markSourcesSynced()` (enforced by
  `validate:sync-freshness`). Never write it inline.
- **Robots-crawl-delay syncs can't use a single Vercel cron — shard by day-of-month.**
  The Wikidata syncs (`sync-officeholders`, `sync-wikidata`) finish in one monthly cron
  because SPARQL is a bulk endpoint. The CIA World Leaders cabinet sync
  (`sync-cia-cabinets`) is a page-by-page HTML crawl bound by cia.gov's 10s robots
  crawl-delay → a full ~230-country pass is 35–45 min (measured 170 min with retries),
  far past any Vercel function budget (800s Pro max). Fix: the cron runs DAILY and
  crawls one 28th of the deterministic sorted slug list (`getUTCDate()-1 % 28`, ~9
  countries, measured 227s), cycling the whole directory monthly. Idempotent
  (re-matches existing persons, 0 dupes). Any future crawl-delay-bound adapter must
  shard the same way, not mirror the SPARQL crons' single-monthly-run shape.
- Rankings dedup is `DISTINCT ON (jurisdiction, fact_key)` (latent today; matters once a
  ranking fact-key gains a 2nd source).
- Phase F canonical-fact values are human-readable strings ("Liberal Democracy",
  "High income", "North America"), NOT snake_case slugs. `lens-metadata.ts` returns null for
  unknown values rather than crashing.

## Pulse (currently PAUSED — no API spend)
- The v2 pipeline self-corrects SUBJECT-country attribution via
  `src/lib/pulse/v2/country-attribution.ts` (wired into `classify.ts`) — ignore the story's
  language/outlet, attribute to the country the event is ABOUT.
- The `pulse-daily` skill runs the refresh on the Max SUBSCRIPTION, not the API: export
  clusters (free) → the AGENT classifies → apply via the validated `writeEvent` (free).
  Subscription billing requires NO bare `ANTHROPIC_API_KEY` in the env (the suffixed
  `ANTHROPIC_API_KEY_*` keys only feed project scripts, never Claude Code auth).
- Lazy-init the Anthropic client (a module-level `new Anthropic()` evaluates before dotenv
  populates env vars).

## Deferred / calendar-gated (do NOT "fix" unasked)
- **Design-system "v2 palette fork"** — owner-deferred (see memory-decisions 2026-06-20). Code
  uses Bronze/Parchment + soft shadows; DESIGN.md/CLAUDE.md/embed still describe the v1
  cinnabar/hard-shadow look; the `--shadow-hard*` tokens are now soft. Don't reconcile until
  the owner picks the canonical look.
- **`structural_family` removal** — only Phase 6 remains, calendar-gated to **2027-03-31** (drop
  the columns + constants, 410 the legacy `/api/v1/government-types`). See memory-decisions
  2026-05-02.
- **~18 near-identical factbook sync adapters** — DRY refactor deferred.
- **Outcomes section** (peer-band graph) postponed pending peer-comparison methodology — slot
  kept as a comment in `factbook/[slug]/page.tsx`.
