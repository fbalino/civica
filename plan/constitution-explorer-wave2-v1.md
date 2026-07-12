# Constitution Explorer — Wave 2 build plan (v1, 2026-07-01)

From the 2026-07-01 recon (Sonnet agent; API endpoints verified live by direct calls).
Phases: **2a ingest → 2b standalone explorer → 2c simplify country tab.**

## Data source — Constitute Project (verified live 2026-07-01)
Base: `https://www.constituteproject.org/service/` (already in `seed-sources.ts` as
`constitute_project`, license `non-commercial`, `isCommercialUseAllowed: false` — correct;
CC BY-NC 3.0, terms expressly prohibit commercial use. Citation: Elkins/Ginsburg/Melton,
"Constitute: The World's Constitutions to Read, Search, and Compare.").

| Endpoint | Shape |
|---|---|
| `GET /constitutions?lang=en` | 238 rows; filter `in_force: true` → **186**, one per country. Fields: `id` (cons_id, e.g. `United_States_of_America_1992`), `country_id`, `year_enacted`, `year_updated`. |
| `GET /html?cons_id=<id>&lang=en` | `{html, title}` — full text; each section is `<div id="section/N" class="section" data-topics="…ontology/<key1>,<key2>">`. Topic tags are IN the HTML. |
| `GET /topics?lang=en` | Hierarchical taxonomy: 12 categories, **414 leaf topics** (`key`, `label`, `description`, `count`). |
| `GET /locations?lang=en` | country_id → ISO mapping for jurisdiction matching. |
| `GET /sectionstopicsearch?key=<t>&cons_id=<c>` | Per-country topic excerpts (works per cons_id only — do NOT rely on live multi-country queries). |

**Cross-reference mechanism:** parse `data-topics` at INGEST time → normalized
`constitution_topic_excerpts` table → the pane is a pure DB query
(`topic_key = ? AND jurisdiction_id != ?`). No live Constitute calls at page view.

## Current state
- `constitutions` table (schema.ts:173): has `fullTextHtml` (never populated), `constituteProjectId`, `year`, `yearUpdated`, `lastFetched`. NO structured-articles/topic columns.
- Tab `country/[slug]/constitution` → `ConstitutionExplorer.tsx` renders metadata + 9 generic sections + deep-links; auto-renders `fullTextHtml` when present (confirmed real).
- Per-page `src/app/constitution.css` (427 lines) — deprecation target in 2c.
- `getConstitution()` in queries.ts:436. API route `api/countries/[slug]/constitution` exists.
- Possibly-dead: `src/components/atlas/tabs/ConstitutionTab.tsx` — confirm + remove in 2c.

## 2a — Ingestion (schema + script)
- schema.ts: add `constitutions.structured_articles` (jsonb: `[{sectionId, headingLabel, topics[], html}]`)
  + new `constitution_topic_excerpts` table (jurisdictionId, constitutionId, topicKey, topicLabel,
  sectionId, excerptHtml, articleLabel; indexes on topicKey + jurisdictionId).
- `src/lib/constitute/sync-constitutions.ts` (lib core) + `scripts/sync-constitutions.ts` (CLI:
  --dry-run/--limit/--slug) + `sync:constitutions` npm script. Politeness delay + retry ladder +
  per-country skip (mirror cia-cabinets-sync). `markSourcesSynced("constitute_project")` only.
- Topic taxonomy cached to `src/lib/constitute/topic-taxonomy.generated.json` (from `/topics`).
- Country matching: `/locations` ISO → `jurisdictions.iso3`, alias map for stragglers.
- Storage note: full HTML for 186 constitutions ≈ tens of MB (India ~1.5MB) — acceptable on Neon.

## 2b — Standalone Explorer
- Route `/constitution` with `?c=` multi-select (mirror `/compare`'s parseSlugs; extract shared util).
- 3 panes: LEFT `ConstitutionCountryPicker` (search + indexed list), MIDDLE
  `ConstitutionReadingColumn` (structuredArticles, Source Serif reading column, ReaderSidebar
  scroll-spy article nav), RIGHT `ConstitutionCrossReferencePane` (topic picker → excerpts from
  peer constitutions via `constitution_topic_excerpts`).
- `src/lib/db/queries-constitution.ts` (new file per queries-* convention).
- Styles → `.constitution-*` classes in editorial.css. NO per-page <style> (do NOT copy
  compare/page.tsx's inline style block — that's pre-existing drift, flagged for audit).

## 2c — Country tab simplification
- Tab = country's own text (structuredArticles) + "Open in the Constitution Explorer →" CTA.
- Trim/replace ConstitutionExplorer.tsx; retire constitution.css; remove dead atlas ConstitutionTab.

## Sequencing / status
- 2a launched 2026-07-01 (Opus agent). 2b gated on 2a data (partial ingest OK to start UI).
- License posture: display-only, non-commercial; never expose via a paid tier or bulk redistribution.
