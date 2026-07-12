# Government + Leadership Data Enrichment Plan

**Date:** 2026-06-30
**Scope:** Make the country page's **Government** ("How power is organised" org chart) and **Leaders** sections (Civica Data tab, `/country/[slug]/civica-data`) substantive for **all countries**, not just the US/UK.
**Posture:** READ-ONLY plan. No code written, no syncs run, no schema changed. This document is the blueprint.

---

## 1. The gap, verified against the live DB (2026-06-30)

A read-only query against the production Neon DB confirms every claim in the brief and quantifies it:

| Fact | Live number | Meaning |
|---|---|---|
| `offices` total | **389** | one or two per country (HoS + HoG) |
| `offices.name` = generic `"Head of State"`/`"Head of Government"` | **375 of 389 (96%)** | only **14** offices carry a real constitutional title — all US/UK |
| Distinct real office titles | 14 (US 8, UK 6) | "President pro tempore", "Chancellor of the Exchequer", "Chief Justice", etc. |
| `persons` total | **331** | each has exactly one `wikidata_qid` |
| `persons.photo_url` populated | **0 of 331 (0%)** | no leader portraits anywhere |
| `persons.date_of_birth` populated | **0 of 331 (0%)** | no birthdates / ages / bios |
| `persons.wikidata_qid` populated | **331 of 331 (100%)** | ← **the enrichment spine already exists** |
| `terms` total / current | 392 / 389 | one current term per office |
| `terms.party_name` populated (current) | **11 of 389 (3%)** | US/UK only |
| jurisdictions with a `cabinet` office | **2** | US + UK |
| jurisdictions with a `judicial` body | **2** | US + UK |
| `office_type` breakdown | 189 HoS, 186 HoG, 7 cabinet, 4 legislative_leader, 2 judicial_leader, 1 deputy_head | the long tail is US/UK |
| `legislature_parties` rows | **2,961 across 253 bodies, 194 with color** | a separate, well-populated table — useful as a **party-color reference dictionary** |
| `wikidata` source row | `license = CC0`, `last_sync_at = 2026-05-04` | provenance row exists, CC0, ready |

**The single most important finding:** every one of the 331 leader persons already has a Wikidata Q-ID. That means workstreams 1–3 (titles, portraits, birthdates, party) are *pure enrichment of rows that already exist* — no re-identification, no new entity resolution. We re-query Wikidata keyed on the Q-IDs we already hold and fill blank columns.

### Why the sections look thin today
- **Government org chart** (`FactbookGovOrgChart` + `buildGovStructure`): for ~95% of countries it renders two cards — "Head of State" and "Head of Government" — with the generic title and the holder's name. No cabinet, no judiciary, no real office title.
- **Leaders** (`FactbookLeaders`): renders a monogram avatar (never a photo — the component comment explicitly says `photoUrl` is null for everyone), the generic office label, "in office since" from `term.startDate` (the one rich field, ~94% present), and a party dot only for US/UK.

The UI is already built to light up the moment the data exists. `FactbookLeaders` reads `partyName`/`partyColor` and renders a dot; `getLeaderTimeline` already selects `person.photoUrl`. `buildGovStructure` already threads `party`, `partyColor`, `sinceYear`, and `title` straight from `offices.name`. **No renderer rewrite is needed for workstreams 1–3** — populate the columns and the existing components render them. (Workstream 4 needs new rows + minor renderer attention.)

---

## 2. What Wikidata offers (the data-source reality)

Wikidata is genuinely strong for heads of state/government, their party, image, and birthdate. The relevant properties:

| Property | Meaning | Used where | Realistic coverage for current HoS/HoG |
|---|---|---|---|
| **P39** | *position held* (→ its label, e.g. "President of France") | the real constitutional title | ~95%+ — almost every sitting leader has a P39 statement that is the office |
| **P35 / P6** | *head of state* / *head of government* of the country | already used to find the person | n/a (already wired) |
| **P18** | *image* (a Commons file name) | leader portrait | ~85–92% for current national leaders; lower for very small states |
| **P569** | *date of birth* | age / bio | ~95%+ |
| **P102** | *member of political party* | party affiliation | ~80–88% (lower for monarchs, military officers, technocrats — many legitimately have no party) |
| **P580 / P582** | *start time* / *end time* qualifiers on a statement | tenure dates | already used for term start; P582 absence = "current" |
| **P1813** | short name | already used | n/a |
| **P462 → P465** | party's *color* → *sRGB hex* | party swatch | partial; we already pull this in `sync-wikidata-parties.ts` |

**Key technical nuance about titles (P39):** the current officeholder query uses the *country's* `P35`/`P6` statements, which yield the **person** but not the title. The real title lives on the **person's** `P39` (position held) statement. Two ways to get it:

1. **Preferred — add P39 to the person side of the query.** For each head-of-state/government person, fetch their `P39` statements, filter to the one with no `P582` end-time (the current position) whose `P580` start roughly matches the term start, and take its label. This yields "President of the French Republic", "Prime Minister of Japan", "Federal Chancellor of Germany", "King of Spain", etc.
2. **Fallback — the position item on P35/P6's qualifier.** Some countries model `P35` with a `P39`-style "object has role" qualifier. Less reliable; use only when the person has no clean P39.

Either way, the title comes from Wikidata's own position-item labels — **a real sourced fact, never synthesised.** When no P39 resolves, we keep the honest generic ("Head of State") rather than invent a title.

---

## 3. Provenance & honest-data rules (apply to every workstream)

Non-negotiable, from `AGENTS.md` + project memory:

- **Source = `wikidata`, license `CC0`, `is_commercial_use_allowed = true`** (already seeded). All four workstreams 1–3 inherit this row; no new source row needed. Workstream 4 may need a new source row (see §7.4).
- **Freshness stamping ONLY via `markSourcesSynced("wikidata", { rowsWritten })`** from `src/lib/db/source-freshness.ts`. It stamps only when `rowsWritten > 0` and not a dry run. Never write `last_sync_at` inline. Enforced by `npm run validate:sync-freshness`. The existing officeholder/party scripts already do this correctly — extend the same call.
- **No generated/fabricated values.** Missing image → keep monogram. Missing party → no party dot. Missing P39 title → keep generic label. A blank is always preferable to an invented value (mirrors the 2026-05-01 "Atlas masthead facts must never be generated" decision).
- **Statement-level provenance.** The officeholder script already writes `statements` rows (`sourceId: "wikidata"`, `sourceLicense: "CC0"`, `sourceUrl`, `retrievedAt`). Extend that pattern for new facts (title, image, dob, party) so each carries its own provenance row, and the `SourceDot` on the Leaders/Government cards keeps reading the `wikidata` `last_sync_at` (amber = frozen academic vintage, per the SourceDot rule).
- **Image licensing subtlety:** P18 values are Commons files whose *file-level* license is usually CC-BY-SA or PD, **not** CC0 (the Wikidata *statement* is CC0; the *file* is not). The licensing page already states this correctly ("CC0 or file-level Commons license"). Portraits must therefore carry a per-file credit/license, exactly as `country-photos.ts` / `country-galleries.generated.json` already do for country photos. **This is a methodology flag — see §7.2.**

---

## 4. Prioritised workstreams (highest value × lowest effort first)

Ordering rationale: workstreams 1 and 3 are the cheapest (fill a column on rows that already exist, no schema change, immediate visible payoff on every country) and should ship first. Workstream 2 (portraits) is the highest *visual* impact but carries a licensing/caching decision, so it's second-after-titles. Workstream 4 is a different class of problem (new entities, likely a new source) and is last.

### Priority 1 — Real office / position titles (P39) — **Effort: S–M**
**Value: very high. Effort: low. No schema change. Do this first.**

- **Source / properties:** Wikidata `P39` (position held) label, filtered to the current position (`P582` absent), matched to the term via `P580`.
- **Coverage estimate:** ~90–95% of the 375 generic offices become real titles ("President of Brazil", "Prime Minister of India", "King of Morocco", "Federal President", "State Counsellor", etc.). The remainder keep the honest generic.
- **Implementation:** **Extend `scripts/sync-wikidata-officeholders.ts`.** Add a P39 lookup. Cleanest path: a second SPARQL query keyed on the head-of-state/government person Q-IDs we already store (`persons.wikidata_qid`), returning each person's current `P39` position label. Then `UPDATE offices SET name = <position label> WHERE …` for the matching `(body, office_type)`. Because `offices` already has `wikidata_qid` (the position can be stored there too), also set `offices.wikidata_qid = <position Q-ID>` for traceability.
  - Guard: only overwrite `name` when it currently equals the generic string, so a hand-curated US/UK title is never clobbered.
  - The renderer (`buildGovStructure` → `role.title = office.name`; `FactbookLeaders` → `humanizeSectionLabel(officeName)`) already displays `offices.name`, so the title appears with zero UI change.
- **Schema changes:** **none.** `offices.name` and `offices.wikidata_qid` already exist.
- **Provenance:** write a `statements` row per office (`predicate: "position_held"`, `objectValue: <title>`, `sourceUrl: https://www.wikidata.org/wiki/<positionQid>`).
- **Risks:**
  - *Multilingual labels.* Already handled — the officeholder script has `LABEL_LANG_PRIORITY = [en, mul, la, fr, es, de, pt]` and an entity-API fallback; reuse it for position labels so we never store a bare `Q…`.
  - *Multiple P39s per person.* A leader may hold several positions (e.g. also an MP). Filter to the one whose `P580` matches the term start and whose item is an instance of/subclass of an executive office; prefer the statement with `preferred` rank.
  - *Title vs. role drift* — a president who is also party leader. Take the head-of-state/government position only, not "leader of party X".

### Priority 2 — Leader portraits + birthdates/bios (P18, P569) — **Effort: M**
**Value: very high visual impact. Effort: medium (licensing + caching decision).**

- **Source / properties:** Wikidata `P18` (image → Commons file), `P569` (date of birth). Optionally `P19` (place of birth), `P140`/`P106` for richer bios — defer those; portrait + DOB/age is the high-value core.
- **Coverage estimate:** P18 ~85–92% of current national leaders; P569 ~95%. Small states and a few interim leaders will lack an image → monogram stays (the component already handles this perfectly).
- **Implementation:** **Extend `sync-wikidata-officeholders.ts`** (or a sibling `sync-wikidata-leader-media.ts` that runs after it, keyed on `persons.wikidata_qid`). For each person:
  - `date_of_birth` → write directly to `persons.date_of_birth` (column already exists).
  - `photo_url` → **decision point (see §7.2).** Two options:
    - **(A) Store the Commons resolver URL** (`https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=320`) directly in `persons.photo_url`. Cheapest. Risk: hotlinking at render time (CORS is fine for `<img>`, but Commons asks callers to cache; large originals; occasional 404 when a file is renamed).
    - **(B) Cache locally** to `/public/leaders/<qid>.webp`, mirroring the **existing, proven** `scripts/sync-country-galleries.ts` pattern (it already pulls P18 + Commons category photos into local `.webp` and a generated JSON with per-file license/credit). Store the local path in `persons.photo_url`. More work, but consistent with how Civica already handles Commons media, avoids hotlinking, and lets us convert to `.webp` (the repo's standing rule: "convert `public/...png` → `.webp`").
  - **Recommendation:** Option B — reuse the country-galleries machinery. It already solves Commons file-name → download → license capture → local webp. A leader portrait is the same problem at person granularity.
- **Schema changes:** **none for the minimum.** `persons.photo_url` + `persons.date_of_birth` exist. *If* we want per-portrait credit/license stored relationally (rather than in a generated JSON), add `persons.photo_credit text` + `persons.photo_license text` (small additive migration) — but the country-galleries precedent stores those in a generated JSON sidecar, so a migration may be unnecessary. **Flag for owner (§7.2).**
- **UI work:** small. `getLeaderTimeline` already selects `photoUrl`; `FactbookLeaders` currently *ignores* it and always renders a monogram. Add: render `<img>` when `photoUrl` exists, fall back to monogram otherwise (never a broken-image flash). Add an age/`since-birth` line and the portrait credit line (mirroring the country-page hero credit pattern in `country/[slug]/layout.tsx`). The org chart can stay text-only or add a small avatar — owner's call.
- **Provenance / licensing:** **the image is NOT CC0** — capture the Commons file's own license + author per file, exactly as `country-galleries.generated.json` does. Render a credit ("Photo: <author> · <license> · Wikimedia Commons"). The licensing page copy already anticipates this.
- **Risks:**
  - *Hotlinking / CORS / rate limits* if Option A — mitigated by Option B (local cache).
  - *Stale images* — a former leader's photo lingering. Mitigated because we re-key on current officeholders each sync; when the person changes, the new person's `photo_url` is fetched and the old row is no longer current.
  - *`next/image` not configured for remote hosts* — there is **no `images.remotePatterns`** in `next.config.ts` today, and country photos use plain `<img>` (`optimizedHeroSrc`). Use plain `<img>` for portraits too (consistent), or add a remotePatterns entry if Option A + `next/image` is ever wanted. Option B sidesteps this entirely (local path).
  - *Sensitive imagery / dignity* — national-leader portraits from Commons are editorial/public-domain-ish and low-risk, but keep the credit honest.

### Priority 3 — Party affiliation (P102) — **Effort: S–M**
**Value: high (a party dot on every leader card). Effort: low. No schema change.**

- **Source / properties:** Wikidata `P102` (member of political party) → party label; party's `P462 → P465` → sRGB color hex. We already pull party color this exact way in `sync-wikidata-parties.ts`.
- **Coverage estimate:** ~80–88% of current HoS/HoG. Monarchs, military leaders, and some technocrats legitimately have no party — those correctly render no dot.
- **Implementation:** **Extend `sync-wikidata-officeholders.ts`.** When upserting a term, also query the person's `P102` (current party — filter `P582` absent if qualified) and the party's color. Write to `terms.party_name` + `terms.party_color` (columns exist). **Reuse `legislature_parties` as a color dictionary:** 194 bodies already have party colors; when P462→P465 is missing for a person's party, fall back to a matching `legislature_parties.party_color` by name within the same country. This raises color coverage materially with zero extra Wikidata calls.
- **Schema changes:** **none.** `terms.party_name` + `terms.party_color` exist.
- **Provenance:** `statements` row `predicate: "member_of_party"`.
- **Renderer:** zero change — `FactbookLeaders` and `buildGovStructure` already read `partyName`/`partyColor` and render the dot.
- **Risks:**
  - *Party-color mapping* — Wikidata color coverage is patchy and sometimes wrong (a generic "blue"). The `legislature_parties` fallback + a small hardcoded override table for the largest party families (if needed) mitigates. Never invent a color — omit the dot if unknown (the component handles a null color).
  - *Coalition / "independent"* — store the literal party label; if P102 is "independent politician", store "Independent" (real), not blank.
  - *Multiple parties over time* — filter to the current membership (no `P582`).

### Priority 4 — Cabinet ministers + judicial bodies — **Effort: L**
**Value: high for depth, but a different class of problem. Effort: large. Do last.**

This is the only workstream that creates **new entities** (new `offices`, new `persons`, new `government_bodies`, new `terms`) rather than enriching existing rows, and it is where Wikidata coverage thins out and inconsistency rises.

- **Cabinets:**
  - *Wikidata path (partial):* `P39` positions like "Minister of Foreign Affairs of X" exist for many countries, and the current holder (no `P582`) can be queried per position item. But cabinet **completeness** on Wikidata is wildly uneven — strong for G20, sparse-to-absent for small states, and the set of "which ministries exist" is not cleanly enumerable per country.
  - *Better source:* a structured government-directory source. Candidates: **CIA World Factbook "Chiefs of State and Cabinet Members of Foreign Governments"** (a real, public-domain CIA publication, updated weekly, listing each country's cabinet by title + name — this is the canonical fit and matches Civica's existing CIA provenance posture), or Wikidata "cabinet of X" item membership where it exists. **Recommendation: CIA Chiefs-of-State directory as the primary cabinet source, Wikidata as the identity/portrait join.**
  - *Effort:* L. New importer (`scripts/import-cabinet-directory.ts`), new `offices` rows under each country's `Executive` body with real ministry titles, `terms` for current holders, person resolution (match to existing `persons` by name/Wikidata where possible, else create).
- **Judicial bodies:**
  - *Wikidata path:* "Supreme Court of X" / "Constitutional Court of X" items exist for most countries (`P31` highest-court classes), and the current chief justice can sometimes be found via `P1308` (officeholder) or the court's `P488` (chairperson). Coverage moderate. Constitute Project (already a Civica source, non-commercial) describes judicial structure but not current personnel.
  - *Effort:* M–L. New `government_bodies` rows with `branch = 'judicial'`, a `judicial_leader` office, and the current chief justice term.
- **Schema changes:** likely **none required** — `government_bodies` (with `branch`), `offices` (with `office_type` = `cabinet` / `judicial_leader`), `persons`, `terms` all already model this (the US/UK rows prove the shape works). Optional additive: `offices.display_order` for stable cabinet ordering, and `government_bodies.body_type` values already cover `cabinet`/`judiciary`.
- **Provenance:** if CIA directory is used, it is a **different source** (`cia_factbook` already exists as a source row, or a new `cia_chiefs_of_state` row) — seed it with its license (public domain) and stamp via `markSourcesSynced`.
- **UI:** the renderers already support this tier — `FactbookGovOrgChart` renders cabinet cards and chamber/court leadership today (it's how US/UK look rich). Populating the rows lights it up. Minor attention: the "Other offices" branch grouping in `FactbookLeaders` and the `OFFICE_RANK` maps already include `cabinet` / `judicial_leader`.
- **Risks:**
  - *Source beyond Wikidata needed* — confirmed; do not force Wikidata to do cabinets.
  - *Ministry-title normalisation across languages* — "Minister of the Interior" vs "Home Secretary" vs "Minister of Internal Affairs". Keep the source's own title verbatim (citation honesty), do not normalise to a Civica-invented taxonomy (consistent with the `structural_family` retirement philosophy).
  - *Churn* — cabinets reshuffle often; a weekly/monthly re-sync cadence is needed, vs. the slower HoS/HoG cadence.
  - *Volume* — ~190 countries × ~15–25 ministers = thousands of new rows + person resolution; this is the real cost.

---

## 5. Recommended build order

1. **Priority 1 — Titles (P39).** Cheapest, no schema change, every country improves immediately, the org chart and leader cards stop saying "Head of State" generically. Ship first.
2. **Priority 3 — Party (P102 + color).** Same script extension, no schema change, adds a party dot to most leader cards. Bundle with #1 in one extended `sync-wikidata-officeholders.ts` pass (both are person-keyed Wikidata lookups; one round of SPARQL work).
3. **Priority 2 — Portraits + DOB (P18 + P569).** Highest visual payoff but carries the licensing/caching decision (§7.2). Do after #1/#3 land so the textual layer is already solid. Reuse the `country-galleries` caching machinery.
4. **Priority 4 — Cabinets + judiciary.** Separate epic, new source (CIA Chiefs-of-State directory recommended), new entity import, ongoing churn. Last.

Steps 1–3 are roughly one focused build each (and 1+3 can be a single PR). Step 4 is its own multi-session effort.

---

## 6. Implementation summary table

| # | Workstream | Source + properties | Coverage | Approach | Schema change | Effort | Top risk |
|---|---|---|---|---|---|---|---|
| 1 | Real office titles | Wikidata P39 label | ~90–95% | Extend `sync-wikidata-officeholders.ts`; update `offices.name`/`wikidata_qid` (guard generic-only) | none | **S–M** | multilingual labels, multi-P39 disambiguation |
| 2 | Portraits + DOB | Wikidata P18, P569 | P18 ~85–92%, P569 ~95% | Extend officeholder sync or sibling script; cache via existing `country-galleries` machinery → `/public/leaders/*.webp`; write `persons.photo_url` + `date_of_birth` | none (optional `photo_credit`/`photo_license` cols) | **M** | image license ≠ CC0; hotlinking if not cached |
| 3 | Party affiliation | Wikidata P102 + P462→P465; fallback `legislature_parties` color | ~80–88% | Extend officeholder sync; write `terms.party_name`/`party_color` | none | **S–M** | party-color accuracy |
| 4 | Cabinet + judiciary | **CIA Chiefs-of-State directory** (cabinets) + Wikidata court items (judiciary) | varies widely | New importer; new `government_bodies`/`offices`/`terms`/`persons` rows | none (additive `display_order` optional) | **L** | needs non-Wikidata source; title normalisation; churn/volume |

---

## 7. Methodology / owner-decision flags

These are genuine decisions, not execution details. Surface to the owner before building.

### 7.1 Monarch vs. president vs. chancellor display
P39 will surface real titles like "King of Spain", "Federal Chancellor", "State Counsellor", "Captain Regent". Decide:
- Do we display the verbatim Wikidata title, or normalise (e.g. always show "Head of State · King of Spain")? **Recommendation: verbatim title as the primary label, with the generic role as a quiet secondary tag** (consistent with citation honesty and the no-Civica-taxonomy stance). A monarch should read as "King", not be flattened to "President".
- Ceremonial vs. executive heads (a parliamentary monarch + a PM): the org chart already merges HoS=HoG for presidential systems; for monarchies it correctly shows both. No change needed, but confirm the visual treatment (e.g. a "ceremonial" tag) — that tag would be a Civica assertion, so **only add it if sourced** (e.g. from the existing government-taxonomy `executive_structure`), never inferred.

### 7.2 Store Wikidata image URLs vs. cache them locally
The licensing reality forces a choice (image file ≠ CC0):
- **Cache locally (recommended):** reuse `scripts/sync-country-galleries.ts` machinery → `/public/leaders/<qid>.webp` + captured per-file license/credit. Consistent with existing Commons handling, no hotlinking, convertible to webp.
- **Hotlink:** store the Commons `Special:FilePath` URL in `persons.photo_url`. Cheaper but violates Commons caching etiquette, risks 404s on file renames, and needs `next.config` remotePatterns if `next/image` is used.
- Sub-decision: store per-portrait credit/license **relationally** (new `persons.photo_credit`/`photo_license` columns) or in a **generated JSON sidecar** (the country-galleries precedent)? Recommendation: match the existing sidecar pattern to avoid a migration, unless the owner wants portrait provenance queryable in SQL.

### 7.3 Cabinet source selection (Workstream 4)
Recommend **CIA "Chiefs of State and Cabinet Members of Foreign Governments"** (public domain, weekly, complete per country, matches existing CIA provenance) as the primary cabinet source over forcing Wikidata. This is a methodology choice with citation implications — confirm before building the importer. If chosen, seed/confirm its `sources` row + license and stamp via `markSourcesSynced`.

### 7.4 Sync cadence
HoS/HoG/titles/party/portraits change slowly (re-sync monthly or on a Pulse-adjacent trigger). Cabinets churn fast (weekly). If Workstream 4 lands, it needs its own cadence — decide whether it joins a cron (the plan already targets cron-ifying syncs) or stays manual.

### 7.5 Person de-duplication for Workstream 4
New cabinet/judicial persons must resolve against the existing 331 `persons` (a foreign minister who is also tracked elsewhere). Match on Wikidata Q-ID first, then name — same `upsertPerson` logic the officeholder script already uses. Confirm we want one canonical person per Q-ID across all their offices (yes — the schema already supports a person holding multiple terms).

---

## 8. What does NOT need to change
- **No renderer rewrite for Workstreams 1 & 3.** `FactbookLeaders`, `FactbookGovOrgChart`, `buildGovStructure`, and `getLeaderTimeline` already read title/party/color/since and degrade cleanly on null. Populate columns → UI lights up.
- **No new source row for Workstreams 1–3** — the `wikidata` / CC0 row is seeded and stamped.
- **No change to freshness plumbing** — keep using `markSourcesSynced("wikidata", { rowsWritten })`.
- **The honest-data posture is preserved** — every new value is a real Wikidata/CIA fact; missing data stays blank (monogram, no dot, generic title), never invented.

---

## 9. One-paragraph recommendation
Start by extending `scripts/sync-wikidata-officeholders.ts` in a single pass to fetch each current leader's **P39 position title** and **P102 party (+ color, with a `legislature_parties` color fallback)**, keyed on the Q-IDs we already store — no schema change, no UI change, and 96% of countries stop showing the generic "Head of State". Then add **P18 portraits + P569 birthdates**, caching images locally with the proven `country-galleries` machinery and per-file Commons credit. Defer **cabinets + judiciary** to a separate epic backed by the CIA Chiefs-of-State directory, since that is the only piece Wikidata can't carry. Flag the monarch-vs-president display convention and the image-cache-vs-hotlink choice to the owner before building Workstream 2.
