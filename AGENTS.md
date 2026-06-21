# Civica — Agent Instructions

## Project Overview
Civica is a modern, visual replacement for the CIA World Factbook — an interactive platform visualizing government structures for every country, with an original governance scoring system (the Civica Index) that blends quarterly structural data with daily event-sensitive signals (the Civica Pulse). The goal is academic citability plus a beautiful, shareable, editorial reading experience.

Domain: `civicaatlas.org`.

## Design system is non-negotiable
- Read [DESIGN.md](DESIGN.md) before any UI work.
- No hardcoded hex / rgb / rgba / oklch in component code or page CSS — use `var(--color-*)`. Hex literals are only allowed inside `:root` token-definition blocks and inside `<DesignSystemSwatch>`.
- No hardcoded `font-family`, `font-size` in px, or padding/margin magic numbers in new UI — use `--font-*`, `--text-*`, and `--space-*`.
- New pages must build on shared primitives: `<EditorialPage>`, `<SectionHeader>`, `<Banner>`, `<Pill>`, `<DataTable>`, and `<SourceDot>`.
- **Reader-style pages compose `editorial.css` classes — no per-page `<style>` blocks.** If you find yourself reaching for a `<style>` block to set max-width, padding, breadcrumb typography, section heading sizes, filter chips, or list-card layout, the class already exists in `src/app/editorial.css`. If the pattern truly is missing, add it there once and reuse it everywhere.
- The `/design-system` page is the only source of canonical visuals. If your page does not look like a piece of `/design-system`, it is wrong.

## North stars
- **Design system is canonical.** Before creating any new page or component, consult [`/design-system`](https://www.civicaatlas.org/design-system). Any styling that drifts from those tokens is a bug.
- **Civica Index and Civica Pulse are the product.** Everything else (countries, elections, compare, outcomes) is evidence for them. When in doubt, make features reinforce that identity.
- **Provenance is load-bearing.** Every data point traces to a source row with a license and `last_sync_at`. Sync scripts MUST stamp `sources.last_sync_at = NOW()` on success.
- **Academic legitimacy matters.** The Bjornskov-Rode / CGV regime taxonomy and BR/CGV attribution is already integrated — keep it prominent.

## Active plan
Consult `~/.claude/plans/excellent-findings-thank-you-bubbly-kay.md` for the current phased roadmap (bug sweep → unified `/compare` → three-pane shell refactor → IA consolidation → widget gallery → legitimacy workstream).

## Tech Stack
- **Next.js 16.2** (App Router, Turbopack, React 19.2)
- **Neon** (serverless Postgres via `@neondatabase/serverless`)
- **Drizzle ORM** (type-safe, schema in `src/lib/db/schema.ts`)
- **Tailwind CSS v4** + hand-authored editorial CSS (`src/app/globals.css`, `src/app/atlas.css`, design tokens)
- **Anthropic SDK 0.90** — `claude-sonnet-4-6` powers `/api/chat` and Pulse event classification

<!-- BEGIN:nextjs-agent-rules -->
## Next.js 16 Rules
This version has breaking changes. Read `node_modules/next/dist/docs/` before writing code.
- `params` and `searchParams` MUST be awaited (async)
- `middleware.ts` is deprecated — use `proxy.ts`
- Turbopack is default — config goes at top level of nextConfig
- When cacheComponents is enabled, use `use cache` directive instead of `export const dynamic`
<!-- END:nextjs-agent-rules -->

## Database
- Schema: `src/lib/db/schema.ts` — **45 tables** across government structure, factbook, Civica Index scoring, Pulse, provenance, and organizations
- Connection: `src/lib/db/index.ts` (lazy-initialized HTTP client)
- Queries: `src/lib/db/queries.ts`
- Drizzle config: `drizzle.config.ts` (reads `.env.local`)
- Government taxonomy helper layer: `src/lib/db/government-taxonomy.ts` + `src/lib/government-taxonomy/*`

## Design System (authoritative)
**See `https://www.civicaatlas.org/design-system` for the live reference.** Code lives in `src/app/globals.css`, `src/app/atlas.css`, and `src/app/design-system/page.tsx`.

- **Typography**: Fraunces (serif, display + country cards), Inter (sans, body/interface), `ui-monospace` (labels, source/meta rows, IDs, code, dense numeric UI only). Do NOT substitute IBM Plex or other fonts. Do NOT use mono for tabs or readable facts like government type, region, capital, population, or GDP.
- **Color palette** (light): paper `#f4f1ea`, ink `#1a1a1a`, muted `#8a8370`, rule `#c4bdae`, accent (cinnabar) `oklch(58% 0.14 35)`. Dark mode flips via `data-theme="dark"`.
- **Signal colors**: olive (success), amber (warn/frozen), brick (danger), slate (info).
- **Government-type palette**: parliamentary blue, presidential rust, semi-presidential purple, monarchy gold, theocracy green — always use the CSS vars (`--gov-parl`, `--gov-pres`, etc.).
- **Tier palette** (CI 0-100): exceptional → strong → mixed → weak → failed, mapped via `var(--tier-*)`.
- **Shadows**: hard-offset, no blur (`4px 4px 0 var(--ink)`). Print-inspired.
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
- GDELT (news events) — feeds the Civica Pulse daily via Anthropic classification

## Environment variables (all in `.env.local`, documented in `.env.example`)
- `DATABASE_URL` — Neon Postgres connection (required)
- `ANTHROPIC_API_KEY` — required for `/api/chat` + Pulse classification
- `ADMIN_API_KEY` — bearer token for `/api/admin/*` (401 if unset)
- `CRON_SECRET` — bearer token for Vercel cron endpoints at `/api/cron/pulse/*`
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
- `npm run ingest:pulse:events` — pull latest GDELT events (→ classification → scoring pipeline)
- `npm run db:generate` / `npm run db:push` — Drizzle migrations

## Civica Index pipeline (manual today; cron target in the plan)
1. `tsx scripts/ingest-ci-all.ts` — runs all 6 dimension adapters (V-Dem, WGI, HDI, Freedom House, CPI, GPI)
2. `tsx scripts/calculate-ci-composite.ts` — computes composite scores and ranks
3. For Pulse: `tsx scripts/ingest-pulse-events.ts` → `tsx scripts/classify-pulse-events.ts` → `tsx scripts/calculate-pulse-scores.ts`

## Reader-page prose lives in `content/*.md`, not TSX
Seven `content/*.md` files are now the rendered prose source of truth for their paired pages (`/about`, `/methodology`, `/methodology/approach`, `/civica-index/methodology`, `/civica-index/methodology/peer-grouping`, `/civica-index/methodology/pulse`, `/civica-index/methodology/pca-appendix`). The TSX shells wrap the markdown via `<MarkdownContent>` from `src/components/content/`. Edit prose in the markdown file, NOT the TSX. The TSX shell only owns layout, rich components (weights bar, bands scale, version strip, source-card grids, eigenvalue chart), DB-driven blocks (revision history, source list), CiteAccordion invocations, and footer nav.

- **Any methodology number cited in `content/*.md` is a `{{state.*}}` or `{{stats.*}}` interpolation, not a hardcode.** Drift between the rendered page and the live DB is caught by `npm run validate:content-templates`. New hardcoded numbers in markdown are a bug.
- **Sidebar anchors are stable ids written `## Heading {#anchor-id}` in markdown.** The `remark-civica-anchors` plugin assigns the id; renaming the heading prose doesn't break the sidebar link.
- **Soft-fail every `{{stats.*}}` reference** with a `| "fallback"` arg. Pages must render coherently when `getSiteStats()` throws (e.g., DB unreachable). Mirror the try/catch in `src/app/(reader)/methodology/approach/page.tsx`.
- **The seventh file (`content/methodology-reconciliation.md`) is deferred** until the `<WorkedExample>` editorial primitive lands (per `~/civica/plan/content-templating-implementation-v1.md` §3.2). Its TSX page at `src/app/(reader)/factbook/methodology/reconciliation/page.tsx` remains the prose source of truth in the meantime.
- **Discipline before push:** when editing methodology prose, run `npm run validate:content-templates` and verify the affected page renders correctly on `localhost:3000`. Add `ctx.*` keys to the validator's `CTX_ALLOWLIST` whenever a markdown file references a new pre-computed helper.

Full architecture documented at `~/civica/plan/content-templating-implementation-v1.md` (substitution engine, slice prop, soft-fail discipline, per-page strategy, `<WorkedExample>` follow-up).

## Footer invariants
These links MUST survive any header/footer refactor:
- Blog · API Docs · Design System · **Status Page** (https://statuspage.incident.io/civica-atlas) · Licensing · Contact · GitHub

## Committing
- Civica currently tolerates a pre-existing repo-wide lint failure unrelated to normal work (old React effect/hook warnings). Do not fix unrelated lint just to make a commit green; focus on what you touched.
- Do NOT ship `npm run sync:*` changes that drop `last_sync_at` updates. If you add a new sync script, stamp the source.
- `sources.last_sync_at` must be stamped ONLY via `markSourcesSynced()` from `src/lib/db/source-freshness.ts` — the single sanctioned path. It stamps exclusively when a run actually wrote rows (`!dryRun && rowsWritten > 0`), so a failed or empty sync never fakes freshness. Never write `last_sync_at` directly (no inline `.set({ lastSyncAt })`, `onConflictDoUpdate` set blocks, or raw `SET last_sync_at` UPDATEs). Enforced by `npm run validate:sync-freshness`.
