# Civica feature roadmap (sequenced) — 2026-06-30

Maps the remaining `mockups/` ideas onto the new `/country/[slug]` 3-tab IA (Factbook ·
Civica Data · Constitution) + the standalone surfaces (Atlas, Civica Index leaderboard,
Compare, Elections, embed). The `mockups/` are **idea/feature references only** — every build
adopts the current almanac design system, not the mockup's raw styling.

**Already built (do NOT rebuild):** the `civica-index-*` mockups (leaderboard, methodology,
changelog, widget, country-detail→now the Civica Data tab, government-types), the `editorial-*`
mockups (longform, updates-index, glossary), and `factbook-landing-A/B/C` (→ the /country landing).

**Standing constraints to respect:**
- **Pulse is PAUSED** (no API spend). Any Pulse-dependent feature is gated on un-pausing.
- **Civica Index methodology is beta / under rework** (memory-decisions 2026-04-24). CI-shape
  features should not hard-couple to current dimension internals.
- New Civica-asserted composites ship with a **Beta** chip until externally reviewed; features
  citing external sources inherit the source's standing.

---

## Wave 2 — Constitution Explorer (HIGH; owner explicitly keen)
The cross-reference pane is the whole point — "how this passage appears in other constitutions."
Best as a **dedicated 3-pane page**, with the country tab holding just the text + a link to it.

- **2a — Ingest full constitution text.** Source: **Constitute Project** (full text of ~190
  constitutions, structured by article/section). License: **non-commercial use is permitted** —
  fits Civica today. ⚠️ FLAG: commercial use would need a license review (revisit if Civica ever
  monetizes). Pipeline: fetch Constitute's per-country structured text → store in the
  `constitution` table (`fullTextHtml` / a structured articles JSON) → stamp provenance via
  `markSourcesSynced`. The Explorer ALREADY auto-renders `fullTextHtml` once present.
- **2b — Standalone Constitution Explorer page** (`/constitution` or `/constitution/[slug]`),
  3-pane like the mockup: LEFT = country selector (search + list); MIDDLE = the selected
  constitution, navigable by title/article (Source Serif reading column); RIGHT = **cross-reference
  pane** — for the article/topic in view, show how peer constitutions treat the same topic
  (Constitute's topic tagging enables this — e.g. "term limits", "judicial independence"). Compare
  2+ countries side by side.
- **2c — Simplify the country Constitution tab** to just the country's constitution text (once
  ingested) + a prominent "Open in the Constitution Explorer →" link. (Until 2a lands, the tab
  stays the current honest metadata + Constitute deep-links.)
- Data dependency: 2a gates 2b/2c's full value. Effort: ingestion (medium) + explorer page (large).

## Wave 3 — SHIPPED (commit a77271c, 2026-06-30) + the data-enrichment finding
The 4 data-backed sections were deepened (Government branch hierarchy + current officeholders;
Legislature chamber composition + party browser; Leaders profiles + transitions timeline;
Organizations enriched memberships) — file-disjoint opus agents, honest to real data, tokens-only.
**KEY FINDING — the bottleneck is now DATA, not UI.** The agents' DB audit showed the depth is thin
for most countries, so the new UI is rich on US/UK and degrades honestly elsewhere. Highest-leverage
next move = a **government/leadership data-enrichment pass** (a PREREQUISITE for these sections to be
substantive everywhere), specifically:
- `offices.name` is the generic "Head of State"/"Head of Government" for 183/~190 countries — enrich to
  the real constitutional title (President / Prime Minister / Monarch), e.g. derive from
  government_form / monarchy_status.
- Cabinet/ministry offices exist for only US+UK; judicial bodies only US+UK — populate more countries.
- `persons.photoUrl` / `dateOfBirth` are 0% populated (no leader portraits/bios).
- Officeholder party affiliation (term.partyName/Color) only ~11/389; legislature party leaders/
  founding years (wikidata_qid) universally null.
- UN-vote-alignment + chamber-linked election results have no usable data (skipped in the build).

## (original) Wave 3 — Civica Data tab deepenings (each enriches an existing tab section)
- **Government hierarchy chart** (`04-19`) → deepen the Government section's org chart (richer
  branches/offices/terms). Data: `government_structure` (exists).
- **Legislature deep-dive** (`04-18`) → expand the Legislature section (committees, seat history,
  vote breakdowns) beyond the current hemicycle. Data: IPU Parline + Wikidata parties.
- **Political party browser** (`04-18`) → a parties view under Legislature (party profiles,
  seat share over time). Data: party-seat data (partial; Wikidata fallback exists).
- **World leader profiles** (`04-18`) + **leadership transitions** (`04-20`) → deepen the Leaders
  section (profile detail + a transitions timeline). Data: `leader_timeline` / Wikidata.
- **International organizations** (`04-20` ×3) + **country relations / UN alignment** (`04-21`) →
  enrich the Organizations section + the standalone `/organizations` (membership detail,
  co-member networks, UN-vote alignment). Data: `organization_memberships` (exists); UN-alignment
  needs a voting-record source (new).
- **Country outcome bars** (`04-20`) → the long-deferred Outcomes/peer-band section. GATED on the
  peer-comparison methodology (see memory; slot reserved in the old factbook page comment).

## Wave 4 — Civica Index features (coordinate with the CI methodology rework)
- **Democracy dashboard** (`04-18`) → a richer CI/governance dashboard (per-dimension deep views).
- **Democracy backsliding tracker** (`06-21`) → flags significant negative CI/Pulse movements.
  Partly Pulse-dependent (gated on un-pause for the daily signal).
- **Historical trend charts** (`05-24`) → richer CI history (the current panel chart is minimal);
  multi-dimension over time.
- **Press-freedom integration** (`05-18`) → surface RSF/press-freedom as a first-class signal
  (already used inside Pulse corroboration; expose it).
- **Civica Index compare** (`04-20`) → enhance `/compare` for CI/dimension comparison.

## Wave 5 — Elections (the `/elections` page exists but is thin)
- **Global election calendar** (`05-17`) + **election timeline** (`04-18`) → upcoming/past
  elections, filterable. Data: election data is sparse today (~22 countries) — needs a feed.
- **Electoral systems explainer** (`04-18`) → reference content on voting systems (editorial +
  per-country system tagging).

## Wave 6 — Atlas + distribution
- **Map layer switcher** (`04-20`) → more choropleth layers on `/atlas` (CI, Pulse, freedom, etc.)
  beyond the current set; the switcher UI. Data: the layers exist; this is UI + wiring.
- **Embeddable country cards** (`04-18`) → extend the embed widget to country-card embeds (the
  `/civica-index/widget` exists; generalize). 
- **Advanced country filters** (`05-20`) → richer filtering on the `/country` landing almanac index
  (by region/income/regime/CI tier). Data: peer-grouping fact-keys (exist).

---

## Suggested order
1. **Wave 2 (Constitution)** — owner's stated priority; self-contained; ingestion unlocks a
   flagship feature. Start with 2a (ingest) → 2b (explorer) → 2c (tab link).
2. **Wave 3 (Civica Data deepenings)** — highest leverage now that the tab exists; each is an
   incremental section upgrade with mostly-existing data.
3. **Wave 4 (CI features)** — after/with the CI methodology rework so we don't build twice.
4. **Waves 5–6** — Elections + Atlas/distribution; some gated on new data feeds.

Each wave = its own focused effort (design → build → verify → ship), same discipline as the
drift wave: tokens-only, browser-verified, committed in slices.
