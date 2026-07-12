# Project Memory Sessions — Durable Learnings

Per the three-bucket rule (memory-docs-hygiene): this file holds ONLY durable,
non-git-recoverable gotchas and constraints. Per-feature "what shipped" history
lives in git (`git log`) and `~/civica/plan/*` — NOT here. Do not add changelogs.

## Current architecture state

- **Replication status (CLM-010).** `replicationPackage` in
  `src/lib/content/site-state.ts` is the canonical nine-component inventory
  for `/civica-index/replication`. `npm run validate:replication-surface`
  forbids pre-G2 availability/links, incomplete published state, missing rows,
  and availability language. Actual artifacts remain owned by DAT-022,
  IDX-028, GOV-021, and QA-020.
- **Documentation-source registry (CLM-009).** `src/lib/docs/doc-concepts.ts`
  names the canonical path/symbol and synchronization mode for methodology and
  release concepts across reader markdown, TSX, API examples, runbooks, memory,
  and generated README surfaces. `npm run validate:doc-sources` is the DB-free
  drift/route/anchor/link guard; do not create an unregistered prose or formula
  mirror.
- **Reader-first (Option B, 2026-06-30).** The three-pane `(shell)` route group is
  GONE; pages are full-width reader pages under `(reader)`. KEPT: `src/lib/shell/events.ts`
  (the `civica:ask` window-event bus — still used by the factbook CivicaAIDrawer / bills /
  atlas) and `src/app/shell.css` (`.atlas-resizer`, used by `/compare`). Atlas is one
  self-contained `/atlas` map page. Redirects in `src/lib/routing/redirects.ts`
  (imported by `next.config.ts`, all 308):
  `/atlas/:slug(/:tab)`→`/country/:slug`, `/atlas/compare`→`/compare`,
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
- **`structural_family` cleanup** — the taxonomy remains retired and must not
  re-enter new paths. The former 2027 compatibility window is no longer an
  owner requirement because Civica has no current API users; when the active
  checklist reaches API/schema cleanup, prefer the clean current contract over
  public migration theater. Preserve only internal history needed for replay or
  a released scholarly artifact. See APR-D020 and memory-decisions 2026-07-09.
- **~18 near-identical factbook sync adapters** — DRY refactor deferred.
- **Country-page peer-band panel** — the site-wide conditions explorer shipped at
  `/civica-conditions`; what remains deferred is the per-country outcome peer-band panel
  (component built, unwired), pending the peer-comparison methodology extension to material
  outcomes.

## 2026-07-10 — CLM-008 Index method reconciliation

- Completed CLM-008 with subscription-authenticated `gpt-5.3-codex-spark`, Claude Opus 4.8, and Claude Sonnet 5 workers under a one-writer/review-repair loop.
- Corrected public source, normalization, missingness, uncertainty, and Beta-status prose; fixed `/rankings` to use raw values through the v2 display transform rather than archived v1 normalized values.
- Added `src/lib/ci/__tests__/worked-examples.test.ts`, seeded RNG injection, and exported pure production seams so the documentation examples are executable without a database.
- Full tests/validators/build and desktop/mobile light/dark browser QA passed. Evidence is in `plan/evidence/CLM-008/`.

## 2026-07-10 — DAT-006 reconciliation and source independence

- Completed DAT-006 directly in the primary Codex session without external
  workers.
- Added an explicit policy for every canonical fact key and one claim-level
  lineage function shared by the reconciliation and provenance audits.
- The live audit maps all active source/fact relationships and the eight live
  resolver examples pass. The stricter family rule reports 458 fact groups
  with two-plus independent producing families.
- Full claims/docs validation, production build, 398 tests, and desktop/mobile
  Playwright checks passed. A pre-existing footer country-search hydration
  warning appeared in local dev logs; DAT-006's page and API returned 200.

## 2026-07-10 — DAT-007 deterministic source precedence

- Adopted `source-precedence/v1`, added public decision traces, and made the
  public provenance schema strict about decision-reason and trace enums.
- Browser/API verification exposed database-order nondeterminism between an
  equal-vintage UN population row and its World Bank republisher. The resolver
  now uses lineage-aware precedence plus a stable source-ID tie-break.
- Ten focused fixtures, all eight live worked examples, 408 tests, the full
  claims gate, TypeScript, production build, and desktop/mobile methodology
  screenshots passed. The unrelated footer search hydration warning persists.

## 2026-07-10 — DAT-008 source freshness semantics

- Hardened the sole source-freshness helper so only successful positive-row
  writes with valid source IDs and timestamps can stamp `last_sync_at`.
- Added 11 behavioral fixtures and made the repository scanner prove itself
  against three seeded forbidden writes and three safe controls.
- No public UI changed; DAT-008 therefore required code/build evidence rather
  than browser screenshots.

## 2026-07-10 — DAT-009 full-schema data dictionary

- Added a deterministic dictionary for all 49 tables and 558 columns, with
  explicit release scopes for public, Beta, support, internal, and private data.
- Combined Drizzle introspection with a reviewed semantic registry; the build
  now fails when schema or policy changes are not reflected in the checked
  artifact.
- Fixed composite-index reporting during review so a column in a multi-column
  unique key is not labeled individually unique.
- Six focused fixtures, TypeScript, targeted ESLint, 425 tests, and the full
  production build passed. No rendered UI changed.

## 2026-07-10 — DAT-010 row-level derivation versions

- Added shared typed version envelopes to six derived research tables and all
  eight production writers, plus version requirements for release artifacts and
  future exports.
- Applied migration 0021 transactionally to production. All live rows have
  non-null envelopes; historical rows are explicitly legacy unversioned.
- Regenerated the schema dictionary (570 columns) and the frozen Index adapter
  hash after the writer change.
- Fourteen focused fixtures, 439 tests, TypeScript, targeted ESLint, and the full
  production build passed. No rendered UI changed.

## 2026-07-10 — DAT-011 immutable input reconstruction records

- Added a self-hashed retention manifest for the frozen 2024-Q4 Index metadata
  release: four raw capture records, five value groups, and composite lineage.
- Publisher payloads remain excluded. Exact byte hashes, retrieval metadata,
  rights, adapter versions, semantic checksums, and fail-closed reacquisition
  instructions preserve the reconstruction path.
- Seven focused fixtures, 446 tests, targeted ESLint, TypeScript, and the full
  production build passed. No rendered UI changed.

## 2026-07-10 — DAT-012 Pulse v2 repeatability wave

- Added deterministic, zero-write dry-run and fixture seams to all five Pulse
  stages: ingest, cluster, classify, corroborate, and score.
- Added cluster/source uniqueness constraints so retries converge instead of
  duplicating classified events or source links; migration 0022 is live and
  its postflight audit is clean.
- Twenty-three focused tests, 469 full tests, runtime/data/freshness validators,
  and the production build passed. DAT-012 remains open for the other adapter
  families.

## 2026-07-10 — DAT-012 bills repeatability wave

- Hardened the shared runner/writer behind all six deployed bills adapters.
  Every cron now supports a zero-write dry run, external emptiness fails
  closed, and whole-batch validation prevents partial malformed writes.
- Content-identical reruns are true no-ops: no row timestamp churn and no
  source-freshness restamp. Source-shaped fixtures exercise all six country
  parsers twice.
- Seven focused tests, 476 full tests, and the production build passed.
  DAT-012 remains open for the remaining adapter families.

## 2026-07-10 — DAT-012 factbook external boundary wave

- Wired all 18 external factbook crons to dry-run and fail-closed outcome
  handling. Error-bearing or zero-row summaries now fail monitoring instead of
  returning a misleading successful response.
- Prevented every external factbook adapter from advancing source freshness
  after any partial error. Three boundary/contract tests, 479 full tests, and
  the production build passed.
- These adapters remain in progress until their source-shaped parser and
  two-run canonical-state fixtures land.

## 2026-07-10 — DAT-012 factbook fixture tranche 1

- Added bounded production seams and source-shaped repeatability fixtures for
  World Bank WDI, IMF WEO, UN Data, and WHO GHO.
- Each adapter now has executable proof for applied two-run canonical
  convergence, stable zero-write dry runs, and upstream failures that cannot
  stamp freshness.
- Twelve focused tests, 491 full tests, and the production build passed.
  Factbook fixture coverage is 4 of 18 external adapters.

## 2026-07-10 — DAT-012 factbook publisher-fixture completion

- Completed bounded production seams and repeatability fixtures for all 18
  external factbook publisher adapters, including Stats SA's injected PDF and
  model-extraction boundary and the combined classifications pipeline.
- Fifty-four focused tests prove two-run semantic convergence, stable
  zero-write dry runs, and fail-closed freshness behavior across the family.
- The full suite passes 533/533, source-freshness validation passes, and the
  production build passes. DAT-012 remains open for other factbook jobs and
  manual Atlas/Index/Conditions entrypoints.

## 2026-07-10 — DAT-012 remaining factbook-job completion

- Added repeatability fixtures and cron dry-run support for Wikidata facts,
  Wikidata officeholders, CIA World Leaders cabinets, cache refresh, quarterly
  vintage snapshots, and stale-dispute auto-resolution.
- Applied reruns converge without duplicate canonical facts, organization
  spine rows, people, terms, statements, offices, vintages, or audit actions;
  publisher failures cannot advance freshness.
- The read-only reconciliation verifier retains its 24-case suite. All 25
  scheduled factbook jobs are now covered; 551/551 full tests and the
  production build pass. DAT-012 remains open for ten manual pipelines.

## 2026-07-10 — DAT-012 completed across all production pipelines

- Closed the ten manual Atlas/Index/Conditions families. All 23 underlying
  scripts expose explicit dry-run, and shared validated writers now own CIA
  seed, constitution, election, legislature-composition, V-Party/history,
  taxonomy, metric, Index, and Conditions persistence.
- Twenty-nine manual checks prove applied reruns converge, dry runs write
  nothing, and malformed/empty/duplicate fixtures fail before freshness. This
  completes all 45 registered pipelines (35 scheduled + 10 manual).
- Final acceptance: 580/580 tests, TypeScript, targeted ESLint, freshness,
  production-adapter, source-input, raw-retention, derivation-version,
  claims/docs, and production build pass. DAT-012 is complete; DAT-013 is next.

## 2026-07-10 — DAT-013 migration discipline completed

- Registered all 36 migration/data-change artifacts: 25 SQL files and 11
  operational scripts. The registry preserves the real 12-entry journal, two
  sequence collisions, and later unjournaled files instead of inventing history.
- Added a zero-write planner with live exact pre-change row counts, checked
  36/36 preflight evidence, compensation and invariant policy, internal release
  notes, a guarded disposable-local push path, and a refusing `db:push` command.
- Eight focused fixtures, 588/588 tests, TypeScript, ESLint, documentation,
  claims, and the full build pass. DAT-013 is complete; DAT-014 is next.

## 2026-07-10 — DAT-014 release-quality gate completed

- Added one strict live gate for identifier uniqueness, jurisdiction coverage,
  plausibility ranges, unit/vintage consistency, provenance orphans, duplicate
  canonicals, required fields, row deltas, and source age.
- The checked live report passes seven families and blocks release on one
  North Korea numeric parser corruption plus orphan statement subjects in
  jurisdictions, legislature parties, and terms. DAT-029 and DAT-028 own the
  repairs; the report must stay red until they land.
- Corrected legacy plausibility minima so real microstate and territory values
  are valid. Twelve focused fixtures, 600/600 tests, TypeScript, ESLint,
  documentation, claims, and the production build pass. DAT-015 is next.

## 2026-07-10 — DAT-015 explicit data-value states completed

- Added one seven-state availability contract across country facts, indicator
  history, and country metrics. Database constraints, APIs, shared UI,
  indicator grouping, future exports, and the data dictionary preserve it.
- Applied migration `0023` transactionally to 79,491 live rows; all legacy
  values became observed and the live validator found zero invalid rows.
- Seven focused end-to-end fixtures, 607/607 repository tests, TypeScript,
  ESLint, claims/docs, the production build, and clean browser checks pass.
  Work is paused at the owner's request; DAT-016 has not started.

## 2026-07-10 — DAT-016 research evidence retention completed

- Applied migration `0024`: 29 evidence-bearing relations now write complete
  UPDATE/DELETE history before mutation, and the history ledger is append-only.
- Pulse classifier negatives remain in `raw_events`; source and reviewer audit
  rows cannot cascade away. Internal Pulse and reconciliation views expose 14
  and 36 current evaluation records respectively.
- Seven focused fixtures, 614/614 tests, TypeScript, ESLint, live migration and
  query checks, documentation, claims, and the production build pass. DAT-017
  is next.

## 2026-07-11 — DAT-017 frozen Atlas export completed

- Published `atlas-2026-07-11`: 253 jurisdiction rows, 12,373 frozen canonical
  facts, and embedded rights records for CIA Factbook, Wikidata, and World
  Bank in one deterministic gzip JSON package.
- The package carries a field codebook, stable joins, value states, vintages,
  source terms, ordering, dates, counts, and checked hashes. Index, Pulse,
  pending sources, images, constitution text, and publisher payloads stay out.
- Live regeneration matched the checked bytes; 617/617 tests, browser/download
  checks, claims/docs, and the production build pass. DAT-018 is next.

## 2026-07-11 — DAT-018 release BOM completed

- Expanded the Atlas manifest to `civica-release-bom/v1`: semantic and gzip
  hashes/sizes, row counts, four schemas, export source commit, five tool
  versions, and per-source vintage/retrieval/semantic-hash records.
- Added a public immutable manifest download beside the data archive. Live
  reconstruction reproduces the normalized export and BOM exactly.
- Four focused fixtures, 618/618 tests, TypeScript, ESLint, browser/HTTP checks,
  claims/docs, and the production build pass. DAT-019 is next.

## 2026-07-11 — DAT-019 clean-room reproduction completed

- Added a public three-jurisdiction fixture covering permitted frozen CIA
  Factbook, Wikidata, and World Bank canonical rows through the export builder.
- Exact fixture/export hashes, rights, row counts, and relational joins fail
  closed. The runbook explicitly does not claim full uncaptured-input replay.
- A credential- and cache-free temporary checkout passed strict reproduction,
  619/619 tests, every validator, and the production build. DAT-020 is next.

## 2026-07-11 — DAT-020 domain source coverage completed

- Published one generated dashboard/API for all nine required Atlas domains,
  scoped to 194 sovereign-state rows with per-domain field and source rules.
- The checked snapshot reports three current domains, six needing attention,
  and eleven threshold alerts; missing organization-run provenance stays open.
- Live regeneration, 622/622 tests, all gates, the production build, and
  desktop/light/dark/mobile browser checks pass. DAT-021 is next.

## 2026-07-11 — DAT-021 backup and recovery drill completed

- Restored a production-read-only PostgreSQL 17 dump into a disposable local
  cluster; 50-table schema, counts, and critical source/data hashes matched.
- Replayed archived WAL to a named pre-mutation point and independently restored
  the frozen Atlas archive against its BOM. Verified restore time was 3.319s.
- Recorded provider PITR/media gaps, deleted all temporary recovery material,
  and added a build validator. DAT-022 is next.

## 2026-07-11 — DAT-022 G2 Atlas candidate completed

- Packaged a deterministic 16-file Atlas G2 candidate and 1.87 MB archival ZIP
  with versioned code, export, manifests, codebook, coverage, citation, and QA.
- Clean-room reproduction matches the full semantic and file hashes with no
  credentials or history; 622/622 tests and the production build pass.
- The guarantee covers immutable canonical vintage rows, not alternates or
  unretained raw publisher bytes. DAT-023 is next.

## 2026-07-11 — DAT-023 frozen-vintage immutability completed

- Repaired 17,506 Atlas rows to the version printed in their release label and
  hashed all 237 named Index score rows before installing immutable triggers.
- Exact reruns are deterministic no-ops; conflicts require a new explicitly
  superseding version. Rollback-only mutation probes were rejected.
- Migration gates, live audit, 626/626 tests, TypeScript, claims/docs, and the
  production build pass. DAT-024 is next.

## 2026-07-11 — DAT-024 as-published export boundary completed

- `civica-atlas-export/v3` emits 12,373 rights-cleared canonical facts from the
  immutable Q1 vintage with its label, cutoff, source-row ID, hash, and method.
- 161 selected live source rows now differ from the cut; none can enter the old
  release. The release, BOM, G2 bundle, clean-room and recovery evidence agree.
- 628/628 tests, live reconstruction, all gates, build, and browser/download
  checks pass. DAT-025 is next.

## 2026-07-11 — DAT-025 temporal metadata completed

- Added a four-clock contract across frozen Atlas rows/exports and BR/CGV:
  observation year, upstream release, retrieval time, Civica publication.
- Corrected 187 populated BR/CGV rows from false reference year 2025 to the
  codebook's 2022; original v6.1, QoG Jan26, retrieval, and Civica version stay
  separate. Honest historical nulls remain where only post-cut state exists.
- 631/631 tests, live audit, release rebuild, all gates, build, API, and
  desktop/mobile browser checks pass. DAT-026 is next.

## 2026-07-11 — DAT-026 authoritative migration path completed

- Replaced the incomplete deploy history with a 50-table authoritative baseline,
  hash-pinned manifest, full-catalog fingerprint, and fail-closed migrator.
- Fresh PostgreSQL 17 creation and exact production adoption produce the same
  fingerprint; the production adoption replayed no public DDL or data writes.
- 633/633 tests, live validation, all gates, and the production build pass.
  DAT-027 is next.

## 2026-07-11 — DAT-027 country research exports completed

- Replaced the blocked mixed-source route with `country-research-export/v1`:
  one canonical per exported fact plus typed alternates, projections, and
  rejected evidence, with complete provenance and resolver metadata.
- Rights filtering never changes the empirical winner. Restricted canonical
  facts are withheld; France JSON/CSV live rows match 53-to-53, while fixtures
  prove all four classes and population semantic parity.
- 636/636 tests, browser/API checks, all gates, and the production build pass.
  DAT-028 is next.

## 2026-07-11 — DAT-028 statement provenance repair completed

- Repaired person-as-term, body-as-party, orphan, and duplicate statement rows;
  all 6,768 live subjects now resolve and duplicate identity groups are zero.
- Closed the subject registry and added database subject validation plus
  source-specific uniqueness; all seven producers use the matching identity.
- The repair remains auditable through 5,365 update and 1,123 delete history
  rows. 636/636 tests, fresh/live migration proof, and the build pass.
  DAT-029 is next.

## 2026-07-11 — DAT-029 numeric quarantine completed

- Replaced the CIA prose parser that combined the year 2010 with a later
  “billion” scale; ambiguous ranges and multi-value percentages fail closed.
- The writer now persists invalid numeric candidates as rejected evidence.
  Migration `0002` quarantined the North Korea row and retained its source,
  prose, and pre-change audit state without inventing an alternate value.
- Five microstate/territory edge fixtures stay active; the live quality report
  is green across all nine families. 641/641 tests and build pass. DAT-030 next.

## 2026-07-11 — DAT-030 atomic Index ingestion completed

- Five child adapters now stage off-table; the orchestrator validates the exact
  source basket, shared version/period, coverage, identities, and checksum.
- A seeded first-adapter failure exited nonzero, recorded failed/not-run states,
  and left the prior 1,142-row score hash unchanged with zero score mutations.
- A real run atomically published 745 rows and source timestamps under one
  completed manifest/checksum. 644/644 tests and build pass. DAT-031 is next.

## 2026-07-11 — DAT-031 explicit fact read selection completed

- Country list, detail, and research export now require `as_of=live` or a full
  immutable vintage label; missing, shorthand, and unsupported values fail.
- Live metadata excludes frozen identity. Vintage values and peer filters read
  only snapshot rows with no current cache fallback; metadata is row-derived.
- A live post-cut differential, 647/647 tests, claims/docs, API contracts, and
  the production build pass. DAT-032 is next.

## 2026-07-11 — DAT-032 complete candidate vintages completed

- Applied authoritative migrations 0005/0006 and published the v0.3-beta Q2
  release with 25,827 frozen candidates and 17,515 linked winners.
- Exact rerun is a no-op; database mutation probes fail; API metadata exposes
  Q1 legacy versus Q2 complete-candidate status and checksums.
- A 4.9 MB local package replayed both release checksums with zero network
  requests. 651/651 tests, browser/API checks, and build pass. DAT-033 next.

## 2026-07-11 — IDX-006 longitudinal research panel completed

- Froze a private 2000–2024, five-indicator research grid with 24,250 cells,
  including 4,384 typed gaps and full source-native metadata.
- Completed rows and release metadata are immutable; checked aggregate artifacts
  retain deterministic row, coverage, and temporal-break hashes without exposing
  mixed-rights source values.
- Static/live validators, mutation probes, 672/672 tests, methodology browser
  verification, and the production build pass. IDX-007 is next.

## 2026-07-11 — IDX-007 Index research charter completed

- Adopted a governing charter that limits original measurement to auditable
  institutional facts or measurement-ecosystem meta-measurement.
- Candidates must add information and beat a relevant baseline on a locked user
  task; the dashboard/no-score baseline and no-winner outcome remain valid.
- Machine contract, validator, and 674/674 tests pass. IDX-008 is next.

## 2026-07-11 — IDX-008 candidate specifications completed

- Defined six materially different tournament candidates, including the
  source-native dashboard/no-score floor and the hardened current composite.
- Every candidate now has a complete claim, data, transformation, uncertainty,
  versioning, validation, presentation, and retirement contract.
- Seeded duplicate-set validation and 677/677 tests pass. IDX-009 is next.

## 2026-07-11 — IDX-009 alternative-family gate completed

- Candidate validation now requires provenance-native disagreement or fact work
  plus a separate sourced institutional-structure alternative.
- Every qualifying candidate must explicitly reject hidden aggregation, ranking,
  scoring, or country-quality inference. IDX-010 is next.

## 2026-07-11 — IDX-010 tournament preregistration completed

- Locked candidates, baselines, panel and code hashes, temporal/geographic
  holdouts, thresholds, subgroups, sensitivities, missingness, and exclusions.
- Confirmatory gates cannot compensate for each other; exploratory results cannot
  pick a winner, and no winner remains valid. 681/681 tests pass. IDX-011 next.

## 2026-07-11 — IDX-011 simple baselines completed

- Implemented B0 dashboard/no-score, B1 native V-Dem, B2 equal weight, and B3
  development-fitted first-factor methods behind one split/output contract.
- The live private panel exactly reproduces checked counts and hashes without
  publishing restricted values. TypeScript and 684/684 tests pass. IDX-012 next.

## 2026-07-11 — IDX-038 Freedom House panel identity corrected

- Panel v1 used Freedom House's 0–100 total score, not K1's 2–14 PR+CL
  ratings input. Immutable v2 uses the exact hash-pinned publisher workbook.
- Candidate set, preregistration, and baselines advanced to v2 before outcome
  inspection; all v1 artifacts remain preserved. IDX-012 resumes next.

## 2026-07-11 — IDX-038 reopened and closed with WGI fallback

- A second audit found the missing WGI Voice fallback. Panel v3 now retains it
  separately from WGI Rule of Law and applies V-Dem-first precedence.
- Candidate set, preregistration, and baselines advanced to v3 before outcome
  inspection; all earlier releases remain immutable. IDX-012 resumes.

## 2026-07-11 — IDX-012 exact K1 candidate completed

- K1 now runs independently on panel v3 with the exact primary/fallback inputs,
  production weights, missingness, null uncertainty, and competition ranks.
- It emits 3,659 hashed private outputs and exactly reproduces all 190 current
  Beta-R5 composites. TypeScript and 688/688 tests pass. IDX-013 next.

## 2026-07-11 — IDX-032 K2 concordance prototype completed

- K2 computes named three-rater common-coverage percentiles and dispersion for
  3,260 private profiles; final holdouts and expert labels remain sealed.
- Development rejects the midpoint-artifact concern but shows 65.65% drop-one
  tercile instability, so the highlighted summary remains fragile. IDX-033 next.

## 2026-07-11 — IDX-033 K3 ledger prototype completed

- Published the rulebook and generated 168 private statement-cited current
  executive rows; 51 remain contested and 26 jurisdictions lack eligible data.
- Historical transfer and term-limit claims remain uncomputed. Validation is
  preregistered, claims/design gates and browser checks pass. IDX-034 next.

## 2026-07-11 — PUL-009 country-period observability completed

- Pulse runtime method advanced to `pulse-v2.5-beta`; the country-dimensions
  API now carries strict observation and event-observation states.
- Live smoke checks covered Japan, Uruguay, Eritrea, China, and Brazil; absent
  events remain null, low coverage is not assessable, and observed events can
  coexist with low broader coverage.
- The append-only API contract, 786 tests, full build, and responsive light/dark
  methodology checks pass. PUL-010 is next.

## 2026-07-11 — PUL-010 information-environment context completed

- Runtime method `pulse-v2.6-beta` replaces approximate/default country scores
  with a strict versioned context whose missing state stays null.
- The exact RSF 2026 candidate is recorded but production use is disabled for
  rights and validation; legacy multipliers are sensitivity-only.
- Public APIs hide old raw scalars, 794 tests and the production build pass,
  and reader markdown no longer exposes internal HTML claim comments. PUL-011 next.

## 2026-07-11 — PUL-011 independent decision ledger completed

- Runtime method `pulse-v2.7-beta` writes seven independent append-only
  judgments and prohibits a generic confidence payload.
- The live ledger holds 2,688 explicit legacy projections across 384 retained
  events; migration replay, upgrade fixtures, 799 tests, claims, and build pass.
- Public methodology and light/dark browser checks match the runtime contract.
  PUL-012 is next.

## 2026-07-11 — PUL-012 jurisdiction attribution completed

- Runtime method `pulse-v2.8-beta` supports one primary plus affected roles
  with rationales, evidence references, and versioned human-readable entities.
- Live migration covers 384/384 retained events as explicit legacy projections;
  it did not call a model or invent historical multi-country judgments.
- Cross-border DB fixtures, 801 tests, claims, build, and responsive light/dark
  checks pass. PUL-013 is next.

## 2026-07-11 — PUL-013 exclusion evidence completed

- `pulse-candidate-outcome/v1` retains six exclusion outcomes with complete decision context and append-only enforcement.
- Ingestion duplicate attempts now persist individually; older aggregate duplicate counts remain unreconstructed.
- A direct stable sampling view and rolled-back live fixture pass. PUL-014 is next.

## 2026-07-11 — PUL-014 sampling preregistration completed

- Frozen a 384-event census plus 482-valid-case negative and country-day probability frames before labels.
- The frame balances geography, time, language, source type, regime, and retained media-evidence conditions. Primary-stratum values are base weights; deterministic margin repair requires calibrated analysis weights.
- Famous cases remain regression-only; executable population hash is frozen. PUL-015 is next.

## 2026-07-11 — PUL-015 country-day evaluation set completed

- Frozen 536 unlabeled country-day packets across 181 jurisdictions: 482 analysis candidates and 54 same-primary-stratum reserves.
- Every packet carries three exact search families; 1,608 traces retain 6,086 rights-safe result records, while five all-zero packets remain evidence rather than true-negative labels.
- Population, sample, trace, and packet hashes link exactly; 811 tests, claims, and the 98-page build pass. PUL-016 is next.

## 2026-07-11 — PUL-016 independent coding protocol completed

- Frozen 61 operational category boundaries, six worked examples, and 12 answer-free blinded pilot packets under `pulse-independent-coding/v1`.
- Two separate GPT-5.3 Codex Spark dry runs passed the final contract; three disagreements remain visible and no agent output is eligible as gold.
- Three rejected attempts improved the schema, packet naming, and affected-jurisdiction rule. 815 tests, claims, and the 98-page build pass. PUL-017 is next.

## 2026-07-11 — PUL-017 independent coding workspace completed

- A dedicated coder/adjudicator application now enforces separate sessions, blind raw labels, immutable locks, separate adjudication, and stable audit exports across routes and database triggers.
- The live 12-packet dry pilot retains 24 locked submissions, 12 comparisons, and three unresolved disagreements; all temporary access is revoked.
- Browser QA, the 23-migration live ledger, 823 tests, claims, TypeScript, and the production build pass. PUL-018 is next.

## 2026-07-11 — PUL-039 coder recruitment preparation completed

- Prepared role, independence, conflict, qualification, sourcing, outreach, timing, and compensation materials without contacting anyone.
- Executable planning covers 1,456 initial packets and 2,912 assignments; the base budget is $45,615 pending owner approval and a paid timing pilot.
- Spark's read-only audit exposed that two coder-ready packet releases are still missing. PUL-041 now owns them before recruitment or PUL-018.

## 2026-07-11 — GOV-001 publication governance completed

- Adopted a ten-domain charter naming Fernando Balino as the current accountable human and disclosing the project's single-owner governance concentration.
- Agents, models, and anonymous groups have no decision authority; independent reviewers retain their conclusions and original reports.
- Each domain has required evidence and a blocking condition. GOV-002 is next for accountable authorship and contributor identity.

## 2026-07-11 — GOV-002 accountable authorship completed

- Canonical and frozen-release citations now name Fernando Balino personally and retain Civica Atlas as publisher.
- The project claims no institutional affiliation and records no ORCID because none was supplied or reliably found.
- Nine contribution roles and three history periods are machine-readable; 15 generic blog bylines now name the accountable author. GOV-003 is next.

## 2026-07-11 — GOV-004 AI-use disclosure completed

- Published eight distinct model/agent roles with exact production systems where known, controls, and limitations.
- Internal audits and GPT-5.3 Spark coding pilots are explicitly non-peer-review and non-gold; Fernando retains publication responsibility.
- Historical session and launch-image metadata gaps remain visible rather than inferred. GOV-005 is next while GOV-003 awaits owner facts.

## 2026-07-11 — GOV-005 release authority completed

- Named Fernando's gated release, methodology, correction, retraction, supersession, emergency, and restoration authority.
- Frozen corrections use new versions/DOIs and bidirectional relations; retractions keep resolvable tombstones.
- Three no-write tabletops prove material-error, methodology-failure, and rights/security paths. GOV-006 is next.

## 2026-07-11 — GOV-006 advisory-board charter completed

- Published `civica-advisory-board-charter/v1` with five expertise lanes, advisory-only authority, two-year terms, bounded workload, conflict, confidentiality, compensation, departure, consented-publication, and nonendorsement rules.
- Standing service is unpaid; substantial reviews remain separate, optional, and eligible only for outcome-independent owner-approved honoraria.
- The public roster explicitly says no members have been appointed. GOV-007 is next.
