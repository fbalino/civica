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
- Controls are fully rounded as of 2026-07-01: buttons use `--radius-control`,
  chips/pills/badges use `--radius-chip`, and search fields use `--radius-search`.
  Cards, panels, menus, tables, and article callouts keep their smaller surface radii.
- **Hydration:** any SVG built with `Math.cos/sin` must round coords to 2 decimals
  (`Math.round(n*100)/100`) so SSR (Node) and the browser serialize identical attrs. Bit
  `HemicycleCover` and `FactbookLegislatureChart`.
- **Motion** (`motion/react`): always `useReducedMotion` + a no-JS SSR fail-safe (SSR renders
  at full opacity; never ship `opacity:0` that only JS undoes) so content is never trapped
  invisible. No GSAP / marquees / scroll-pinning — wrong register for the almanac.
- `src/app/blog/[slug]/page.tsx` has NO runtime React import (only the global type namespace).
  Use named imports (`isValidElement`), not `React.isValidElement`.
- **LightningCSS (Turbopack's CSS pipeline) SILENTLY DROPS `font-size: max(var(--x), 1em)`** —
  the entire rule vanishes from the built chunk, no warning, dev + prod. Use a literal inside
  `max()` for font-size (e.g. `max(16px, 1em)`). Bit the iOS input auto-zoom guard (globals.css
  `@media (hover:none) and (pointer:coarse)` block — inputs need computed ≥16px or iOS Safari
  zooms the viewport on focus and never zooms back).
- **The root scroller must NOT use CSS `scroll-behavior: smooth` — at all** (2026-07-04).
  It turns the router's scroll-to-top on navigation into an animated scroll the next page's
  render cancels mid-flight → readers land mid-page. The earlier mitigation
  (`<html data-scroll-behavior="smooth">`) proved INSUFFICIENT in production (owner reproduced
  on desktop + mobile with it deployed); both the CSS rule and the attribute are gone.
  globals.css pins `html { scroll-behavior: auto }` with a comment. In-page smooth scrolling
  is JS-only with explicit `behavior: "smooth"` (section navs, ReaderSidebar, constitution
  outline) — never reintroduce the global CSS rule. Also: running `npm run build` while `next dev` is up
  poisons the dev server's chunk cache. A dev RESTART is NOT enough — the poisoned state
  persists in `.next` on disk, and chunk NAMES don't change with content (grep-verifying a
  served chunk can silently test stale bytes). Fix: kill dev, `rm -rf .next`, restart.
  Symptom signature: token/rule exists on disk + tsc clean, but computed styles show initial
  values (empty var() → fill:black / stroke:none).
- **SVG map labels must be a SCREEN-SPACE layer** (sibling of the zoom-transformed <g>;
  positions projected per frame in applyTransform; font/halo/letter-spacing in true screen px
  via the viewBox→viewport ratio — AtlasWorldMap does this). Never put label text inside the
  scaled group: every size property (incl. letter-spacing attrs) fights the transform (halos
  grow, glyphs shrink with zoom). Zoom gates label DENSITY (tiers), never size. Label paint:
  theme-independent white + dark halo (--map-label-fg/-halo tokens).

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

## Admin auth / env / infra gotchas
- **Next.js `.env` does dotenv-EXPANSION on `$`.** Any value in `.env.local` with an
  unescaped `$name` is treated as a variable reference and silently mangled at load
  (a `$` segment starting with a letter → expanded to empty). This bit `ADMIN_PASSWORD_HASH`
  (PHC `scrypt$N$r$p$salt$hash` → salt/hash eaten → correct password rejected). Fix used:
  the admin scrypt hash delimiter is `:` not `$` (`src/lib/admin/password.ts`). RULE: never
  put an unescaped `$` in any `.env.local` value; on Vercel it's stored raw (no expansion),
  so a value can work in prod but fail locally (or vice-versa). In-memory unit tests do NOT
  catch this — it only reproduces through a real `.env` round-trip.
- **Admin auth is username+password ONLY (no bearer).** `ADMIN_API_KEY` is retired; admin
  routes gate on `getAdminSession()` (cookie signed by `ADMIN_SESSION_SECRET` HMAC). Required
  prod/local env: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (via `npm run admin:set-password`),
  `ADMIN_SESSION_SECRET` (`openssl rand -hex 32`). Routes fail closed (sign-in 500 / API 401)
  if any is unset. Crons use a SEPARATE `CRON_SECRET` — unaffected. Setting these on Vercel
  must precede the deploy that ships the change, or the admin backend locks out.
- **Shell `$USERNAME`/`$USER` = the macOS account ("fernandobalino"), not a value you meant.**
  When scripting env writes, pass string literals — a bare `USERNAME=...` assignment can be
  shadowed and `"$USERNAME"` reach Vercel as the OS account name. (Bit the prod `ADMIN_USERNAME`
  write once.)
- **Worktree agents can't boot a Turbopack dev server** (Turbopack rejects a symlink to the
  main repo's `node_modules` across the worktree boundary). Agents that need browser
  verification will either clone `node_modules` in (APFS clonefile) or OVERLAY their diff onto
  the shared main checkout + `pkill` the shared preview server, then revert. After parallel
  worktree agents run, VERIFY main-checkout integrity (`git status`) and expect the preview
  server to have been restarted under you. Do browser verification of merged work in the main
  session, not in the worktrees.

## Pulse (daily cron active; academically experimental)
- The production daily cron was re-enabled on 2026-07-05. Do not describe Pulse
  as paused or cost-free from memory; inspect the current cron/runtime/provider
  configuration before making cadence or spend claims.
- Per the 2026-07-09 atlas-first decision, the near-term defensible product is a
  versioned event ledger. Ensemble agreement is not validation, and public
  numeric deltas remain experimental pending the master-plan gates.
- The v2 pipeline self-corrects SUBJECT-country attribution via
  `src/lib/pulse/v2/country-attribution.ts` (wired into `classify.ts`) — ignore the story's
  language/outlet, attribute to the country the event is ABOUT.
- The local `pulse-daily` subscription skill is a manual workflow, not the
  canonical description of the active production cron. Production classification
  can use configured provider APIs; keep cost controls and provider/version logs
  explicit.
- Lazy-init the Anthropic client (a module-level `new Anthropic()` evaluates before dotenv
  populates env vars).

## Deferred / calendar-gated (do NOT "fix" unasked)
- **`--shadow-hard*` token naming** — owner-gated (see memory-decisions 2026-06-20). The palette
  fork is reconciled: code, DESIGN.md, and the embed all use Parchment + terracotta + soft
  shadows. Only the token NAMES still read "hard" while their values are soft. Don't rename
  unasked.
- **`structural_family` removal** — only Phase 6 remains, calendar-gated to **2027-03-31** (drop
  the columns + constants, 410 the legacy `/api/v1/government-types`). See memory-decisions
  2026-05-02.
- **~18 near-identical factbook sync adapters** — DRY refactor deferred.
- **Country-page peer-band panel** — the site-wide conditions explorer shipped at
  `/civica-conditions`; what remains deferred is the per-country outcome peer-band panel
  (component built, unwired), pending the peer-comparison methodology extension to material
  outcomes.
