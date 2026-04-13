# Civica — Agent Instructions

## Project Overview
Civica is a modern, visual replacement for the CIA World Factbook — an interactive platform visualizing government structures for every country.

## Tech Stack
- **Next.js 16.2** (App Router, Turbopack, React 19.2)
- **Neon** (serverless Postgres via `@neondatabase/serverless`)
- **Drizzle ORM** (type-safe, schema in `src/lib/db/schema.ts`)
- **Tailwind CSS v4** (custom editorial design system in `globals.css`)

<!-- BEGIN:nextjs-agent-rules -->
## Next.js 16 Rules
This version has breaking changes. Read `node_modules/next/dist/docs/` before writing code.
- `params` and `searchParams` MUST be awaited (async)
- `middleware.ts` is deprecated — use `proxy.ts`
- Turbopack is default — config goes at top level of nextConfig
- When cacheComponents is enabled, use `use cache` directive instead of `export const dynamic`
<!-- END:nextjs-agent-rules -->

## Database
- Schema: `src/lib/db/schema.ts` (12 tables including provenance layer)
- Connection: `src/lib/db/index.ts` (lazy-initialized)
- Queries: `src/lib/db/queries.ts`
- Drizzle config: `drizzle.config.ts` (reads `.env.local`)

## Data Sources
All sources tracked in `sources` table. Every fact has statement-level provenance.
- CIA Factbook (frozen Jan 2026, public domain)
- Wikidata (CC0, primary identity spine)
- IPU Parline (CC-BY-NC-SA-4.0, non-commercial only)
- Constitute Project (non-commercial only)

## Scripts
- `npm run seed:sources` — seed the sources table
- `npm run seed:factbook` — import CIA World Factbook (clones repo, imports 260+ countries)
- `npm run sync:wikidata` — sync heads of state/government from Wikidata SPARQL
- `npm run db:generate` — generate Drizzle migrations
- `npm run db:push` — push schema to database

## Design System
Editorial reference work aesthetic (not a dashboard). See `globals.css` for tokens.
- IBM Plex family: Serif headings (IBM Plex Serif), sans body (IBM Plex Sans), mono (IBM Plex Mono)
- SourceDot component on every data point (green=live, amber=frozen)
- Dark/light mode via ThemeProvider
- Layout containers: `.editorial-container` (720px), `.wide-container` (960px), `.full-bleed-container` (1200px)
