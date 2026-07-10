# Civica — Agent Instructions

## Project Overview
Civica Atlas is a provenance-first comparative reference to how every country is governed. Country profiles, institutional data, constitutions, elections, source trails, reconciliation, exports, and citation are the primary product. The Civica Index and Civica Pulse are secondary research experiments and must remain visibly beta until the master plan's validation and external-review gates are satisfied.

Domain: `civicaatlas.org`.

## Design system is non-negotiable
- Read [DESIGN.md](DESIGN.md) before any UI work.
- **OWNER MANDATE (2026-07-05, after repeated drift): EVERYTHING follows the
  design system — never hard-code values, EVER.** When the system genuinely
  lacks what you need, the fix is a NEW design-system component/token first
  (globals.css + `/design-system` page + DESIGN.md), then use it — never a
  page-local approximation. **Run `npm run validate:design-tokens` before every
  commit that touches UI** — it fails on any NEW hardcoded color, pixel font
  size, or raw font-family versus the checked-in baseline
  (`scripts/design-token-baseline.json`; the baselined legacy violations are
  the cleanup backlog — ratchet the baseline DOWN with `--update-baseline`
  after sanctioned cleanups, never up).
- No hardcoded hex / rgb / rgba / oklch in component code or page CSS — use `var(--color-*)`. Hex literals are only allowed inside `:root` token-definition blocks and inside `<DesignSystemSwatch>`.
- No hardcoded `font-family`, `font-size` in px, or padding/margin magic numbers in new UI — use `--font-*`, `--text-*`, and `--space-*`.
- New pages must build on shared primitives: `<EditorialPage>`, `<SectionHeader>`, `<Banner>`, `<Chip>` (the tinted sans chip; `<Pill>` is a legacy alias), `<Button>`, `<SegmentedControl>`, `<DataTable>`, and `<SourceDot>`.
- **Reader-style pages compose `editorial.css` classes — no per-page `<style>` blocks.** If you find yourself reaching for a `<style>` block to set max-width, padding, breadcrumb typography, section heading sizes, filter chips, or list-card layout, the class already exists in `src/app/editorial.css`. If the pattern truly is missing, add it there once and reuse it everywhere.
- The `/design-system` page is the only source of canonical visuals. If your page does not look like a piece of `/design-system`, it is wrong.

## North stars
- **Design system is canonical.** Before creating any new page or component, consult [`/design-system`](https://www.civicaatlas.org/design-system). Any styling that drifts from those tokens is a bug.
- **The atlas is the primary product.** Country profiles, institutional evidence, source provenance, reconciliation, exports, and citation lead. Index and Pulse remain secondary research experiments until they earn stronger standing through the active master plan.
- **Provenance is load-bearing.** Every data point traces to a source row with a license and `last_sync_at`. Sync scripts MUST stamp `sources.last_sync_at = NOW()` on success.
- **Academic legitimacy matters.** The Bjornskov-Rode / CGV regime taxonomy and BR/CGV attribution is already integrated — keep it prominent.

## Active plan
The active source of execution truth is `plan/MASTER-CHECKLIST.md`, governed by
`plan/00-mission-and-operating-rules.md`; the plain-language owner view is
`plan/MASTER-PLAN-OVERVIEW.md`. The 2026-06-30 feature roadmap and other dated
plans are historical inputs: preserve them, but do not execute an unchecked item
unless it has been imported into the master checklist with a stable task ID.

## Tech Stack
- **Next.js 16.2** (App Router, Turbopack, React 19.2)
- **Neon** (serverless Postgres via `@neondatabase/serverless`)
- **Drizzle ORM** (type-safe, schema in `src/lib/db/schema.ts`)
- **Tailwind CSS v4** + hand-authored editorial CSS (`src/app/globals.css`, `src/app/atlas.css`, design tokens)
- **Multi-provider Pulse classifier** — DeepSeek V4 Flash, GLM 4.7, and Claude Haiku 4.5 voters; Claude Haiku verifies and Claude Sonnet performs separate subject-country attribution
- **Anthropic SDK 0.90** — Claude powers `/api/chat`, Pulse verification/subject attribution, and selected review tools

<!-- BEGIN:nextjs-agent-rules -->
## Next.js 16 Rules
This version has breaking changes. Read `node_modules/next/dist/docs/` before writing code.
- `params` and `searchParams` MUST be awaited (async)
- `middleware.ts` is deprecated — use `proxy.ts`
- Turbopack is default — config goes at top level of nextConfig
- When cacheComponents is enabled, use `use cache` directive instead of `export const dynamic`
<!-- END:nextjs-agent-rules -->

## Database
- Schema: `src/lib/db/schema.ts` — **49 tables** across government structure, factbook, Civica Index scoring, Pulse, provenance, and organizations
- Connection: `src/lib/db/index.ts` (lazy-initialized HTTP client)
- Queries: `src/lib/db/queries.ts`
- Drizzle config: `drizzle.config.ts` (reads `.env.local`)
- Government taxonomy helper layer: `src/lib/db/government-taxonomy.ts` + `src/lib/government-taxonomy/*`
- Entity status is separate from government form: `src/lib/jurisdictions/status-taxonomy.ts` owns the closed `jurisdiction-status/v1` contract. Only `sovereign_state` enters sovereign-state totals; unknown rows fail closed. Run `npm run validate:jurisdiction-status` after code/schema changes and `npm run audit:jurisdiction-status:live` after applying the targeted migration.
- Dataset provenance coverage is generated from the live DB with `npm run generate:fact-coverage`, checked into `src/lib/provenance/fact-coverage.generated.json`, and published at `/methodology/provenance-coverage` plus `/api/provenance-coverage`. Run `npm run validate:fact-coverage` after fact/source/dispute/report changes. Keep it distinct from the compact-renderer audit in `src/lib/claims/provenance-coverage.ts`.

## Design System (authoritative)
**See `https://www.civicaatlas.org/design-system` for the live reference.** Code lives in `src/app/globals.css`, `src/app/atlas.css`, and `src/app/design-system/page.tsx`.

- **Typography**: Source Serif 4 (serif, display + country cards) via `--font-heading`, Inter (sans — body/interface/labels/eyebrows/numeric) via `--font-body`. **Monospace (`--font-code`) is reserved for literal code/API snippets only** — never for labels, IDs, meta rows, eyebrows, tabs, or readable facts. (The legacy `--font-mono` token is repointed to Inter so stragglers can't render monospace.) Small-caps labels = Inter + uppercase + letter-spacing; aligned numeric columns = Inter + `font-variant-numeric: tabular-nums`. Do NOT substitute Fraunces, IBM Plex, or other fonts.
- **Components**: build on the canonical primitives — `Chip` (tinted, rounded, mixed-case sans; tonal `neutral/sage/sand/rose/blue/accent`; replaces all old badges/filters/status-pills AND the Beta tag), the `.btn` system / `Button` (primary navy+arrow, secondary outline, tertiary, text), `SegmentedControl`, and rounded-rectangle search fields (`--radius-lg`, not a pill). No ad-hoc buttons, no uppercase-mono pills.
- **Color palette** (light): paper `#FAF7F2` (ivory), ink `#0B1B2D` (navy), muted `#6A7688`, rule `#E4E1DC`, accent (terracotta) `#B7512B`. Foundation hues: navy/deep-teal/sage/terracotta/gold/sand. Dark mode flips via `data-theme="dark"`.
- **Signal colors**: olive (success), amber (warn/frozen), brick (danger), slate (info).
- **Government-type palette**: parliamentary blue, presidential rust, semi-presidential purple, monarchy gold, theocracy green — always use the CSS vars (`--gov-parl`, `--gov-pres`, etc.).
- **Experimental score presentation**: country scores use the neutral `<ScorePosition>` primitive and `--ramp-indicator-*` tokens. Do not use letter grades, qualitative country verdicts, or traffic-light mappings. The `--tier-*` variables are reserved for non-country state/status UI and internal historical replay.
- **Shadows**: soft, subtle, navy-tinted (e.g. `0 1px 2px rgba(15,23,42,.06)`). Elevation is restrained — hairline borders + at most a subtle shadow. (The `--shadow-hard*` token names are legacy; their values are soft, not hard-offset.)
- **Layout containers**: `.editorial-page` (760px narrow reading column), `.editorial-page--wide` (960px), `.editorial-page--full` (1200px standard page width). Most pages should target 1200px; 1280px is reserved for factbook-style pages with two sidebars. Methodology pages and subpages use `.methodology-layout` (1200px with left `ReaderSidebar`, no country search input).
- **Headings**: canonical page H1 is 56px (`var(--text-56)`) except `/blog`, which can keep its separate editorial nameplate.
- **Tabs**: use Inter/body text with normal casing, matching Atlas (`Structure`, `Bills`, etc.). No Roman-numeral monospace tab labels.
- **Hemicycle**: the factbook legislature hemicycle is canonical sitewide (`FactbookLegislatureChart`: rostrum, majority line, stats grid, all-party rows). Do not revive the old design-system demo hemicycle.
- **SourceDot**: every data point carries a provenance dot (green=live, amber=frozen). Use `src/components/SourceDot.tsx` — do not hand-roll.

## Data Sources
All sources tracked in `sources` table. Every fact ideally has statement-level provenance.
- CIA Factbook (frozen Jan 2026, public domain)
- Wikidata (CC0, primary identity spine)
- IPU Parline (CC-BY-NC-SA-4.0, non-commercial only)
- Constitute Project (non-commercial only)
- Bjornskov-Rode / CGV regime taxonomy (QoG Standard Jan 2026) — underpins government classification
- V-Dem, World Bank WGI, UNDP HDI, Freedom House, Transparency CPI, Global Peace Index, Fragile States Index — feed the Civica Index
- Pulse production-active feeds are the observed source IDs in `src/lib/pulse/v2/runtime-method.generated.json`; connector presence alone does not make a feed active

## Source-input manifests

- `src/lib/data/source-input-manifest.ts` is the canonical pipeline/source input contract. It distinguishes stable specifications from captured release inputs.
- A release input is valid only with an exact access URL, retrieval timestamp, SHA-256 content hash, upstream version/vintage, format, expected coverage, redistribution posture, and adapter-version hash.
- `npm run validate:source-input-manifest` closes every scheduled/manual production pipeline and fails if the checked-in release manifest drifts. `npm run generate:source-input-manifest -- --release-id=<id> --pipelines=<id,id>` fails closed when a required capture is absent.
- The current pre-G2 atlas is not a frozen release. Do not fill missing historical input hashes with output hashes, `last_sync_at`, estimates, or invented retrieval times.

## Rights-language discipline

- Free/no-account access, a citation, a download, and permission to use a
  hosted embed are not blanket licenses for the underlying data.
- `src/lib/rights/manifest.ts` is the machine-readable source/field/product/
  release rights contract; `/api/rights-manifest` is its JSON surface and
  `/licensing#rights-manifest` is the reader view. Pending source terms never
  permit public bulk export.
- `src/lib/claims/reuse-rights.ts` remains the public policy/summary registry.
- The repository has no root `LICENSE` file. Do not call the code open-source,
  MIT-licensed, or reusable under a repository license until BRD-007/008 makes
  and implements that decision.
- Run both `npm run validate:rights-manifest` and
  `npm run validate:rights-claims` after changing public rights, licensing,
  downloads, citation, embeds, code-license, or release-manifest language.
- `src/lib/claims/provenance-coverage.ts` measures compact renderer classes on
  home, Atlas, rankings, and embeds. Do not turn its class-level percentage
  into a claim about all database rows or facts; DAT-005 owns that later
  dataset-wide metric. Run `npm run validate:provenance-claims` after changing
  public provenance copy or those four compact surfaces.

## Core environment variables
The complete, authoritative contract (every var, required/optional, and why) is
`.env.example` — read it rather than trusting a partial list here. Headline
variables:
- `DATABASE_URL` — Neon Postgres connection (required)
- `ANTHROPIC_API_KEY_CHAT` — required for `/api/chat`
- `DEEPSEEK_API_KEY`, `GLM_API_KEY`, `ANTHROPIC_API_KEY_PULSE_CLASSIFIER` — default Pulse voters, verification, and subject attribution
- `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` — required admin-login credentials for `/admin` and `/api/admin/*`; routes fail closed if any are unset
- `CRON_SECRET` — bearer token Vercel Cron sends to every scheduled `/api/cron/*` route (bills, factbook syncs, Pulse)
- `CONGRESS_API_KEY` — optional, legacy US-legislative sync

## Scripts
Canonical npm scripts (in `package.json`):
- `npm run seed:sources` — seed the sources table
- `npm run seed:factbook` — import CIA World Factbook (clones repo, imports 250+ countries)
- `npm run sync:wikidata` — sync heads of state/government from Wikidata SPARQL
- `npm run sync:ipu` — sync IPU Parline legislature data
- `npm run sync:wikidata-parties` — Wikidata party-seat fallback
- `npm run sync:government-taxonomy` — ingest Bjornskov-Rode + derive structural taxonomy
- `npm run ingest:government-taxonomy:br` — BR/CGV ingestion only
- `npm run derive:government-taxonomy` — structural derivation only
- `npm run pulse:v2:all` — run Pulse v2 ingest → cluster → classify/verify/subject attribution → corroborate/score
- `npm run pulse:v2:{ingest,cluster,classify,score}` — run one Pulse v2 stage
- `npm run snapshot:pulse-runtime` / `npm run validate:pulse-runtime:live` — regenerate or validate the public runtime-method contract
- `npm run db:generate` / `npm run db:push` — Drizzle migrations

## Civica Index pipeline (manual today; cron target in the plan)
1. `tsx scripts/ingest-ci-all.ts` — runs the four current Beta dimensions: V-Dem primary democratic quality, the disclosed WGI Voice & Accountability coverage fallback, WGI Rule of Law, Freedom House, and Transparency CPI. HDI/GPI are Conditions inputs, not Index dimensions.
2. `tsx scripts/calculate-ci-composite.ts` — computes composite scores and ranks
3. For Pulse v2: `npm run pulse:v2:ingest` → `npm run pulse:v2:cluster` → `npm run pulse:v2:classify` → `npm run pulse:v2:score` (the score step corroborates first, then writes experimental per-dimension deltas)

## Reader-page prose lives in `content/*.md`, not TSX
Seven `content/*.md` files are now the rendered prose source of truth for their paired pages (`/about`, `/methodology`, `/methodology/approach`, `/civica-index/methodology`, `/civica-index/methodology/peer-grouping`, `/civica-index/methodology/pulse`, `/civica-index/methodology/pca-appendix`). The TSX shells wrap the markdown via `<MarkdownContent>` from `src/components/content/`. Edit prose in the markdown file, NOT the TSX. The TSX shell only owns layout, rich components (weights bar, neutral score-position example, version strip, source-card grids, eigenvalue chart), DB-driven blocks (revision history, source list), CiteAccordion invocations, and footer nav.

- **Any methodology number cited in `content/*.md` is a `{{state.*}}` or `{{stats.*}}` interpolation, not a hardcode.** Drift between the rendered page and the live DB is caught by `npm run validate:content-templates`. New hardcoded numbers in markdown are a bug.
- **Sidebar anchors are stable ids written `## Heading {#anchor-id}` in markdown.** The `remark-civica-anchors` plugin assigns the id; renaming the heading prose doesn't break the sidebar link.
- **Soft-fail every `{{stats.*}}` reference** with a `| "fallback"` arg. Pages must render coherently when `getSiteStats()` throws (e.g., DB unreachable). Mirror the try/catch in `src/app/(reader)/methodology/approach/page.tsx`.
- **The seventh file (`content/methodology-reconciliation.md`) is deferred** until the `<WorkedExample>` editorial primitive lands. Its TSX page at `src/app/(reader)/country/methodology/reconciliation/page.tsx` remains the prose source of truth in the meantime; a contract test keeps the deferred markdown's worked-example prose in sync with the reconciliation fact-key thresholds in the interim (`src/lib/factbook/reconcile/__tests__/reconciliation-worked-examples.test.ts`).
- **Discipline before push:** when editing methodology prose, run `npm run validate:content-templates` and verify the affected page renders correctly on `localhost:3000`. Add `ctx.*` keys to the validator's `CTX_ALLOWLIST` whenever a markdown file references a new pre-computed helper.
- **Mutable public counts are registered claims.** A current coverage/count claim in public prose or UI must resolve from runtime state with a nonnumeric soft fallback, or be visibly tied to a dated frozen release. Register it in `PUBLIC_NUMERIC_CLAIMS` (`src/lib/claims/public-numeric-claims.ts`) and run `npm run validate:numeric-claims`; do not restore convenient literals such as `195 countries` or `250+ countries`.

## Footer invariants
These links MUST survive any header/footer refactor:
- Blog · API Docs · Design System · **Status Page** (https://statuspage.incident.io/civica-atlas) · Licensing · Contact · GitHub

## Committing
- Civica currently tolerates a pre-existing repo-wide lint failure unrelated to normal work (old React effect/hook warnings). Do not fix unrelated lint just to make a commit green; focus on what you touched.
- Do NOT ship `npm run sync:*` changes that drop `last_sync_at` updates. If you add a new sync script, stamp the source.
- `sources.last_sync_at` must be stamped ONLY via `markSourcesSynced()` from `src/lib/db/source-freshness.ts` — the single sanctioned path. It stamps exclusively when a run actually wrote rows (`!dryRun && rowsWritten > 0`), so a failed or empty sync never fakes freshness. Never write `last_sync_at` directly (no inline `.set({ lastSyncAt })`, `onConflictDoUpdate` set blocks, or raw `SET last_sync_at` UPDATEs). Enforced by `npm run validate:sync-freshness`.
- Before pushing any change that touches public claims, numbers, methodology prose, routes/anchors, API examples, or research terminology, run `npm run validate:claims-docs` — the single aggregate gate covering registry coverage, numeric templates, routes/anchors, API examples, methodology fixtures (incl. the full unit suite), experimental labels, and terminology/policy overclaims. It runs in CI on every push/PR (`.github/workflows/claims-docs.yml`) and is part of `npm run build`.
