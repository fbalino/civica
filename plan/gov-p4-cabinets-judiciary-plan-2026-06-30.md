# P4 — Cabinets & Judiciary Enrichment Plan (CIA "World Leaders" directory)

**Date:** 2026-06-30 (investigated 2026-07-01)
**Scope:** Populate CABINET MINISTERS (and, as a follow-up, the JUDICIARY — chief justices / high courts) for **all countries**, not just the US + UK, so the Government org chart and Leaders section on `/country/[slug]/civica-data` show real cabinet depth everywhere.
**Posture:** READ-ONLY plan. No code written, no syncs run, no schema changed, no data fetched at scale. This document is the blueprint. It is Priority 4 ("Workstream 4") of `plan/gov-leadership-enrichment-plan-2026-06-30.md`, made concrete.
**Verification:** The source format, licensing, robots posture, and cadence were confirmed by fetching real CIA pages (UK, France, Germany, China, Saudi Arabia, Nauru) plus cia.gov's site-policies and robots.txt. The Civica target shape was confirmed against the live Neon DB and by reading the renderer + existing sync code.

---

## 0. TL;DR / one-paragraph recommendation

Use the **CIA "World Leaders" directory** (`cia.gov/resources/world-leaders/foreign-governments/<country>/`) as the cabinet source: it is US-federal **public domain** (attribution requested, commercial use allowed — matches Civica's existing `cia_factbook` posture), lists **~195 governments** as a clean flat `position title → PERSON NAME` list with **English-translated titles** (no transliteration problem), and updates **monthly** (a fresh archive snapshot each month; per-page "Last Updated" stamps). The catch: **it is HTML-only** — no API, no JSON/CSV/XML, no bulk download — so ingestion is a **per-country HTML parse of ~195 pages** (robots.txt permits it with a 10s crawl-delay). Build it as a new library sync + CLI script + cron route (`/api/cron/factbook/sync-cia-cabinets`) that mirrors `officeholders-sync.ts` exactly (dry-run/apply split, `upsert*`, `statements` provenance, `markSourcesSynced`). Attach cabinet offices to the **already-existing `"Executive of X"` cabinet body** (197 of them exist), creating new `offices(office_type='cabinet')` + `persons` + `terms`. The **existing schema suffices** for a v1 (one additive nullable `offices.display_order` column is *recommended* to preserve CIA list order, but not required). **The judiciary is NOT in the CIA directory** for national governments (verified: UK/France/Germany/China/Saudi national lists carry no chief justice) — so **judiciary is a separate follow-up backed by Wikidata court items, deferred to P4b.** The hard problem is **person identity/dedup**: CIA gives a name only (no Wikidata QID), names are `Firstname SURNAME` (family-name-first for e.g. China), so matching a CIA-listed minister to an existing `persons` row — or deciding to create a new one — is the core methodology risk. Recommend a **dry-run-first** pass (like P1–P3) that reports proposed person matches/creations before any write. **Effort: L.**

---

## 1. Source verdict

### 1.1 Exact URLs (verified live 2026-07-01)
- **Index (current):** `https://www.cia.gov/resources/world-leaders/foreign-governments/` — 199 results, paginated (17 pages), links to one page per government.
- **Per-country (current):** `https://www.cia.gov/resources/world-leaders/foreign-governments/<slug>/`
  e.g. `.../united-kingdom/`, `.../france/`, `.../china/`, `.../saudi-arabia/`, `.../nauru/`. Slug = lowercase, hyphenated country name (`antigua-and-barbuda`, `united-kingdom`).
- **Archive index:** `https://www.cia.gov/resources/world-leaders/historical-data/` — monthly snapshots, 2003–present (`2026-january/` … `2026-may/` seen), same per-country structure under a dated path: `.../historical-data/2026-may/<slug>/`.
- **Licensing / terms:** `https://www.cia.gov/site-policies/`.
- **Robots:** `https://www.cia.gov/robots.txt`.

### 1.2 Real data format — HTML only, no structured export
There is **no API, no JSON, no CSV, no XML, and no bulk/zip download** anywhere on the World Leaders section (index, per-country, or archive-month pages were all checked). Access = **fetch the per-country HTML and parse it.** The structure is highly regular and parse-friendly:

```
# <Country>                              ← page H1
## Leaders and Cabinet Members
**Last Updated**: M/D/YYYY                ← per-page freshness stamp
#### <Position title>                    ← one heading per office
<PERSON NAME>                            ← the holder, on the next line
#### <Position title>
<PERSON NAME>
… (flat list; NO "Ministry of X" nesting, NO party, NO dates, NO photos)
## Explore Foreign Governments           ← end-of-list sentinel
```

Rendered as headings (`####`) + a name line — trivially parseable from the DOM (each position is a heading element; the holder is the adjacent text node). The list is **flat** (no ministry grouping) and contains **only two fields per office: the title and the person's name.** No party, no start date, no birthdate, no image — those must come from the Wikidata join (see §2.4).

### 1.3 Sample — what one country's cabinet looks like (United Kingdom, "Last Updated: 2/6/2026")
```
#### King                                         → CHARLES III
#### Prime Minister, First Lord of the Treasury   → Keir STARMER
#### Deputy Prime Minister, Lord Chancellor, & Sec. of State for Justice → David LAMMY
#### Chancellor of the Exchequer                  → Rachel REEVES
#### Sec. of State for the Home Dept.             → Shabana MAHMOOD
#### Sec. of State for Foreign, Commonwealth, & Development Affairs → Yvette COOPER
#### Sec. of State for Defense                    → John HEALEY
… (~25 more cabinet posts) …
#### Attorney General                             → Richard HERMER
#### Governor, Bank of England                    → Andrew BAILEY
#### Ambassador to the US                         → Christian TURNER
#### Permanent Representative to the UN, New York  → (name)
```
France, Germany, China follow the same shape. **Titles are already in English** ("Fed. Pres.", "Min. of Foreign Affairs", "Chancellor", "Premier, State Council") — the CIA translates them, so there is **no transliteration/multilingual-label problem for titles** (unlike Wikidata P39). Person names are **`Firstname SURNAME`** with the surname uppercased (`Rachel REEVES`); for family-name-first cultures the CIA respects local order (`XI Jinping`, `LI Qiang`) — a real dedup wrinkle (see §2.3).

### 1.4 Judiciary — NOT included for national governments (critical finding)
The national cabinet lists for the UK, France, Germany, China, and Saudi Arabia contain **no chief justice, no supreme court, no constitutional court.** The list is head-of-state + head-of-government + cabinet + a handful of non-cabinet officials (central-bank governor, Ambassador to the US, UN Permanent Representative). The **only** judiciary entries observed were inside **sub-national entries** (China's page appends Hong Kong and Macau, which *do* list "Chief Justice" / "Pres., Court of Final Appeal"). **Conclusion: the CIA World Leaders directory cannot supply the national judiciary.** Judiciary must be a separate workstream (P4b) sourced from Wikidata court items (see §5). This is the single biggest scope correction to the parent plan's Priority 4.

### 1.5 Cadence
- **Monthly.** The archive produces one snapshot per month (`2026-january` … `2026-may` present as of the check). Each per-country page also shows a "Last Updated: M/D/YYYY" that reflects when *that country* last changed. (The parent plan's "~weekly" is the CIA's stated *publishing* cadence for the whole directory; the durable, fetchable artifact is the **monthly** archive snapshot, and individual countries can be stale for years — Saudi Arabia read "9/15/2022".) **A monthly Civica re-sync is the right cadence** (aligns with the existing monthly officeholders cron).

### 1.6 License — public domain, attribution requested (verified)
From `cia.gov/site-policies/` "Copyright Notice": *"Unless a copyright is indicated, information on our website is in the public domain and may be reproduced, published or otherwise used without our permission. We request only that our Agency be cited as the source of the information…"* The World Leaders text carries **no copyright notice** → **public domain, commercial use allowed, attribution to CIA requested.** This is identical to Civica's existing `cia_factbook` source posture (`license: "public_domain"`, `isCommercialUseAllowed: true`). No terms block automated reuse of the text; site-policies only asks that data be acquired directly from cia.gov (which we are doing) and that the CIA be credited.

### 1.7 Fetch feasibility — HTML-parse, moderate difficulty
- **robots.txt:** the `User-agent: *` block only disallows `/js/`, `/preview/`, and `*.js$`, with `Crawl-delay: 10`. The `/resources/world-leaders/` paths are **not disallowed** for general crawlers. → Automated fetching is permitted; **honor the 10-second crawl-delay** (or a polite ~2–5s with a descriptive User-Agent; the officeholders sync already sets `CivicaAtlas/1.0 (…admin@civicaatlas.org)`).
- **403 on naive fetchers:** cia.gov returns **HTTP 403** to the default WebFetch user-agent. A real browser-like User-Agent header is required. The importer must set a proper UA (mirror the Commons UA string already used in `officeholders-sync.ts`).
- **Volume:** ~195 country pages × 1 request, at a ~2–10s delay = **~10–30 min** for a full pass (comparable to the officeholders SPARQL pass at `maxDuration = 800`).
- **Parsing difficulty:** LOW–MODERATE. The heading-then-name structure is regular. The wrinkles are all in §2.2/§2.3 (which entries to keep, name-order, missing names, duplicate titles).

**Verdict:** CIA World Leaders is the right cabinet source — public-domain, complete, English-titled, monthly, and provenance-consistent with Civica's CIA posture. The only cost is that it is HTML-scrape (no structured feed) and it does **not** carry the judiciary.

---

## 2. Ingestion design

### 2.1 Where the data lands (target shape, confirmed against live DB)
Cabinet ministers are modeled today (US/UK) exactly as: **cabinet offices hang off the country's existing `"Executive of <Country>"` body**, which is `body_type='cabinet'`, `branch='executive'`. That body **already exists for 197 countries** (created by the officeholders sync's `upsertBody(..., "executive")`). So for cabinets, the importer usually **adds `offices` to an existing body** rather than creating one.

Per CIA cabinet entry, the importer creates/updates:
| Table | Row | Notes |
|---|---|---|
| `government_bodies` | reuse `"Executive of <Country>"` (`body_type='cabinet'`, `branch='executive'`) | create only if missing (rare — 197/~195 already exist) |
| `offices` | `{ bodyId, name: <CIA title>, officeType: 'cabinet', isElected: false }` | title stored **verbatim** from CIA (citation honesty). `wikidata_qid` = null (CIA gives none). Optional `reportsToOfficeId` → the head office (HoS or HoG per system), mirroring US/UK. |
| `persons` | match-or-create (see §2.3) | `wikidata_qid` filled **only** if the Wikidata join resolves one |
| `terms` | `{ officeId, personId, isCurrent: true }` | `startDate` = null (CIA gives no date), `partyName`/`partyColor` = null (CIA gives none; see §2.4) |
| `statements` | provenance row per term | `subjectTable:'terms'`, `subjectId:personId`, `predicate:'cabinet_member'`, `objectValue:<title>`, `sourceId:'cia_world_leaders'` (or `cia_factbook`), `sourceUrl:<country page URL>`, `sourceLicense:'public_domain'`, `retrievedAt` |

The org chart lights up automatically: `buildGovStructure` (`src/lib/factbook/gov-org-chart.ts`) already places `office_type='cabinet'` offices in the Executive column at `rank: 2` and **suppresses the `"Executive of X"` body card itself** (line 328) so only the offices show. `getGovernmentStructure` (queries.ts:174) selects all offices for the jurisdiction with their current term+person — **no read-path change needed.**

### 2.2 Parsing — which entries to keep, and how
Parse each `#### <title>` → next-line `<NAME>` pair between `## Leaders and Cabinet Members` and `## Explore Foreign Governments`. Then classify each entry:

- **Head of state / head of government** (`King`, `Pres.`, `Prime Min.`, `Chancellor`, `Premier`, etc.): **do NOT re-import.** These are already owned by the Wikidata officeholders spine (with QID, party, portrait, DOB). The CIA importer should **skip** the top head rows and only ingest the cabinet body. (Optionally cross-check the CIA head name against the spine as a data-quality signal, but never overwrite the QID-backed spine with a QID-less CIA name.)
- **Cabinet ministers** (`Min. of …`, `Sec. of State for …`, `Sec. of …`, `Minister Without Portfolio`, `Attorney General`, `State Councilor`, `Vice Premier`, etc.): **ingest as `office_type='cabinet'`.**
- **Non-cabinet officials to EXCLUDE:**
  - `Ambassador to the US` and `Permanent Representative to the UN, New York` — diplomatic postings, US-relational, not cabinet. Exclude (they always appear at the list tail — a convenient sentinel).
  - `Governor, Bank of England` / `Pres., Bundesbank` / `Governor, People's Bank of China` — central-bank governors. **Owner decision (§4):** include as cabinet, or exclude as non-cabinet? Recommend **exclude for v1** (keep the cabinet clean; central banks are deliberately independent), revisit later.
- **Sub-national blocks** (China → Hong Kong, Macau; France → overseas; etc.): the page appends `### <Region>` sub-headers with their own office lists (and *these* can include a Chief Justice). **v1: ignore sub-national blocks** — Civica models sovereign jurisdictions here; attaching HK/Macau offices to "China" would be wrong. (A future sub-jurisdiction workstream could use them.)

Expand the head/cabinet/exclude classification as a small **explicit allow/deny keyword map** (like the officeholders sync's `HEAD_TITLE_RE`), not a fuzzy guess — honest-data discipline.

### 2.3 Person identity / dedup — the core risk (no QID from CIA)
CIA supplies a **name only**. There is no Wikidata QID, no birthdate, nothing to key on. This is the fundamental difference from P1–P3 (which enriched rows that already had a QID). Matching strategy, in order:

1. **Exact name match against existing `persons`** (case-insensitive, after normalizing the CIA `Firstname SURNAME` casing → title case, e.g. `Rachel REEVES` → `Rachel Reeves`). If a unique match exists, reuse that `person.id` (and its QID/photo/DOB come along for free). This will hit for many G20 ministers already in the spine or bills tables.
2. **Wikidata join to acquire a QID** (recommended, raises quality): run a targeted SPARQL/entity-search for `"<name>" + <country> + <position>` (or reuse the office↔position mapping) to resolve a QID, then dedup on QID via the existing `upsertPerson(name, qid)`. This is the same identity spine the rest of Civica uses, so a CIA minister who is also a Wikidata person becomes one canonical `persons` row (schema already supports one person → many terms; verified: Nauru's David Ranibok ADEANG holds a president office + 6 ministries).
3. **Create a new QID-less person** only when neither match resolves: `INSERT persons {name: <title-cased>, wikidataQid: null}`. **This breaks the current 100%-QID invariant** (351/351 persons have a QID today) — an explicit, owner-visible tradeoff (see §4). These persons render fine (monogram, no portrait/DOB), but they are not enrichable by the Wikidata media pass until a QID is later attached.

**Risks & mitigations:**
- **Name-order ambiguity** (`XI Jinping` vs Wikidata "Xi Jinping"; `SURNAME Firstname` for CJK/Hungarian/Vietnamese): the ALL-CAPS surname is a reliable signal of *which token is the family name*, but reconstructing the display order for matching is fiddly. Normalize by de-uppercasing the caps token and matching on the **set** of name tokens, not the order, before falling back to create.
- **Transliteration drift** (Arabic/Cyrillic/Thai names romanized differently by CIA vs Wikidata): exact match will miss; the Wikidata search join (step 2) with country+position context mitigates; otherwise a new person is created (honest, if imperfect). Never fuzzy-merge two persons into one on a loose match — that fabricates identity.
- **Same person, many offices** (Nauru, small states): dedup MUST be person-level so one human = one `persons` row with N `terms`. The `upsertPerson`-by-QID path handles this; the name-match path must also check "already created this run."
- **Missing name** (Saudi Arabia's `King & Prime Min.` / `Crown Prince` showed a title with **no adjacent name** in the scrape; some posts are genuinely vacant or unnamed): create the **office** but **no term** (renders as a vacant role — `buildGovStructure` already supports `vacant: true`). Never invent a holder.
- **Duplicate titles** (Saudi Arabia lists `Min. of State` a dozen times; China `Vice Premier, State Council` several times): the office dedup key CANNOT be `(bodyId, officeType)` (all are `cabinet`) — see §2.5. Key on `(bodyId, normalized title, person)` or append a disambiguator, or model repeated identical-title posts as separate offices.

### 2.4 Party / color for cabinet holders (gap)
CIA supplies no party. The existing P102 party enrichment (`computeEnrichmentPlan`) runs **only on the HoS/HoG spine**, not cabinet. For cabinet party dots, either (a) extend the Wikidata party pass to cover cabinet persons that resolved a QID (reuses `partyQuery` + the `legislature_parties` color fallback), or (b) ship v1 cabinets with **no party dot** (honest — the org chart renders cleanly without one). **Recommend (b) for v1, (a) as a fast-follow** once QIDs are attached. Never invent a party.

### 2.5 Code structure — mirror `officeholders-sync.ts`, with three fixes
Build a library core `src/lib/factbook/cia-cabinets-sync.ts` + CLI `scripts/sync-cia-cabinets.ts` (with `--dry-run`) + cron `src/app/api/cron/factbook/sync-cia-cabinets/route.ts`. Reuse the proven helpers, but note **three concrete gotchas the parent plan didn't surface** (found in the current code):

1. **`upsertOffice` dedup key is `(bodyId, officeType)`** in `officeholders-sync.ts` (lines 297–325). That is correct for one HoS/HoG per body but **collides for N cabinet ministers** (all `office_type='cabinet'` on one body). The cabinet importer must dedup on **`(bodyId, name)`** (or `(bodyId, wikidataQid)` when a QID exists) instead. Do NOT reuse `upsertOffice` unchanged.
2. **`OFFICE_RANK` in `queries.ts` (getLeaderTimeline, ~line 468) uses the key `judicial`, but the stored `office_type` is `judicial_leader`** — so chief justices already fall to the `?? 99` "unknown" rank and sort last in the Leaders list. Add `judicial_leader` (and confirm `cabinet` — present) to that map while implementing, so newly-imported cabinet + judicial leaders sort correctly. (Verified live: `queries.ts` has `judicial: 5`, not `judicial_leader`.)
3. **Provenance is mandatory.** The current US/UK cabinet rows were created by `scripts/enrich-hierarchy.ts` — a **hardcoded** map of two countries that writes **no `statements` rows and never calls `markSourcesSynced`.** That is the anti-pattern. The new importer MUST write a `statements` provenance row per term (mirror `upsertStatement`, `predicate:'cabinet_member'`) and stamp freshness via `markSourcesSynced(<sourceId>, { rowsWritten, executor: db })` — or it violates the AGENTS.md provenance invariant and fails `npm run validate:sync-freshness`. (Consider migrating the two hardcoded US/UK cabinets onto the same sourced path so all cabinets share one provenance model — optional cleanup, flag to owner.)

Reuse unchanged: `upsertPerson` (dedup on QID), `upsertTerm` (idempotent on `(officeId, personId, startDate)`, flips others to non-current — prevents the duplicate-rows bug), `findJurisdiction` (iso2 → qid → alias-slug → slug → name cascade), the `markSourcesSynced` call, and the dry-run/apply `computePlan()` → `reportPlan()` → `apply` split.

### 2.6 Branch tagging
- Cabinet → attach to `branch='executive'` body (`body_type='cabinet'`), `office_type='cabinet'`. ✔ (already the US/UK pattern)
- Judiciary (P4b) → **new** `government_bodies {branch:'judicial', body_type:'judiciary'}` per country + one `office_type='judicial_leader'` office. Only 2 exist today (US Supreme Court, UK Supreme Court).

### 2.7 Should it be its own script + cron?
**Yes.** Mirror the ~23 existing `sync-*` factbook cron routes. New route `/api/cron/factbook/sync-cia-cabinets` (auth via `requireCronAuth` / `CRON_SECRET`, `runtime='nodejs'`, `maxDuration=800`), delegating to the shared library core, ending in `markSourcesSynced`. Add its schedule to `vercel.json` (monthly, offset from the officeholders cron so they don't overlap the 800s budget). Keep it separate from `sync-officeholders` because (a) different source, (b) different cadence sensitivity, (c) the head spine must stay QID-clean and shouldn't be entangled with QID-less cabinet creation.

---

## 3. Schema — existing shape suffices (one recommended additive column)

**No migration is strictly required for a v1.** `office_type`, `body_type`, `branch` are free-text `text` (no DB enums/CHECKs), so `'cabinet'` / `'judicial_leader'` / `'judiciary'` / `'judicial'` are already usable. `persons`, `offices`, `government_bodies`, `terms` all model the tier (US/UK prove it). `statements` already carries per-fact provenance.

**Recommended additive (nullable) column — `offices.display_order integer`:** the CIA lists ministers in a deliberate order (protocol/seniority), and preserving it makes the org chart read correctly. Today `offices` has **no `display_order`** (verified), so cabinet cards would fall back to insert order or the rank sort. Adding a nullable `offices.display_order` (populated with the CIA list index) is a small additive migration, non-breaking, and future-proofs cabinet ordering. **Owner call** — ship v1 without it (accept insert-order) or add it first.

**Invariant note:** creating QID-less cabinet persons **breaks the current "every person has a `wikidata_qid`" property** (351/351 today). No schema change needed (the column is already nullable), but it is a **data-model posture change** worth an explicit owner sign-off (§4).

No other schema changes needed for cabinets. (Judiciary P4b also needs none — same tables.)

---

## 4. Effort, risks, owner-decision flags

**Effort: L.** Breakdown: HTML fetch+parse of ~195 pages (S–M), person identity/dedup + optional Wikidata QID join (**M–L — the real cost**), the sync/CLI/cron scaffold mirroring officeholders (S, well-templated), provenance + freshness wiring (S), the two code-fixes in §2.5 (S). Judiciary (P4b) is a separate **M**.

**Top risks:**
1. **Person identity without a QID** (§2.3) — mismatches, transliteration drift, name-order. Mitigation: exact-match → Wikidata-search-for-QID → create-new, dry-run-reviewed, never fuzzy-merge.
2. **Breaking the 100%-QID invariant** by creating QID-less persons. Mitigation/decision: see flag (a).
3. **HTML brittleness** — cia.gov could restructure the page; the 403-on-naive-UA already shows it's fingerprint-sensitive. Mitigation: descriptive UA, crawl-delay, defensive parse (skip a country cleanly if its page doesn't match the expected shape; never write partial garbage).
4. **Duplicate/blank entries** (Saudi `Min. of State` ×12, unnamed King) — §2.3. Mitigation: office dedup on `(bodyId, name)`; create office-without-term for unnamed posts.
5. **Provenance/freshness omission** repeating the `enrich-hierarchy.ts` mistake. Mitigation: mandatory `statements` + `markSourcesSynced`; `validate:sync-freshness` enforces.

**Owner-decision flags:**
- **(a) How aggressively to auto-create QID-less persons.** Options: (i) **create freely** (max cabinet coverage, but ~thousands of QID-less persons, invariant broken); (ii) **only fill cabinet holders that resolve to an existing person or a Wikidata QID**, skip the rest (keeps the QID invariant, lower coverage); (iii) create QID-less but flag them for a later QID-backfill pass. **Recommendation: (iii)** — create with `wikidata_qid=null`, dry-run-reviewed, and add a follow-up QID-backfill. Needs owner sign-off because it changes the person-identity posture.
- **(b) Source row.** Reuse `cia_factbook` (already public_domain/commercial-OK) or seed a dedicated **`cia_world_leaders`** row (cleaner provenance URLs, distinct cadence). **Recommendation: new `cia_world_leaders` row** — the World Leaders directory is a distinct publication at a distinct URL from the Factbook.
- **(c) Cadence.** Monthly (aligns with officeholders cron). Confirm.
- **(d) Central-bank governors & diplomatic posts** — include in cabinet or exclude? **Recommendation: exclude** (central banks independent; Ambassador/UN-Rep are relational). Confirm.
- **(e) Judiciary in v1 or follow-up?** CIA can't supply it (§1.4). **Recommendation: defer to P4b** (Wikidata court items), ship cabinets first.
- **(f) `offices.display_order`** additive column now, or accept insert-order for v1? (§3)
- **(g) Cabinet party dots** — extend Wikidata P102 to cabinet (needs QIDs) or ship dot-less v1? **Recommendation: dot-less v1, fast-follow.** (§2.4)
- **(h) Migrate the two hardcoded US/UK cabinets** (`enrich-hierarchy.ts`) onto the sourced importer so all cabinets share one provenance model? (optional cleanup)

---

## 5. Recommended phased build order (dry-run-first, like P1–P3)

**P4a — Cabinets (this plan's core):**
1. **Seed source row** (`cia_world_leaders`, `public_domain`, commercial-OK) — or confirm reuse of `cia_factbook`.
2. **Fetcher + parser** (read-only): fetch ~195 country pages (descriptive UA, ~5–10s delay), parse `#### title → name` pairs, classify head/cabinet/exclude, normalize names. Output a structured in-memory list. No DB writes.
3. **`computeCabinetPlan()` (dry-run)** — for each parsed cabinet entry, resolve the jurisdiction, resolve/propose the person (exact-match → Wikidata-QID-search → propose-create), and emit a **report**: counts of offices to create, persons matched vs newly-created (with a sample), unnamed/vacant posts, excluded entries. Prints, writes nothing. **This is the review gate** — mirror `reportEnrichmentPlan`. Get owner sign-off on the person-creation volume before any apply.
4. **Apply step** — create bodies (reuse existing `"Executive of X"`), offices (`office_type='cabinet'`, dedup on `(bodyId, name)`), persons (match-or-create per §2.3), terms (current), and a `statements` provenance row per term. Stamp `markSourcesSynced`.
5. **Two code-fixes** (§2.5): cabinet-safe office dedup; fix `OFFICE_RANK` `judicial` → `judicial_leader` in `queries.ts`.
6. **CLI + cron** (`--dry-run` default-off apply; `/api/cron/factbook/sync-cia-cabinets`, monthly, added to `vercel.json`).
7. **Verify locally**: pick 3–4 countries (a G20, a small state like Nauru, a monarchy like Saudi), load `/country/<slug>/civica-data`, confirm the cabinet renders in the Executive column with correct titles + holders and a CIA SourceDot. Screenshot.

**P4b — Judiciary (follow-up):**
8. Separate Wikidata-backed pass: for each country, find its highest court (`P31` supreme/constitutional-court classes) and current chief justice (`P1308` officeholder / `P488` chairperson), create a `government_bodies{branch:'judicial', body_type:'judiciary'}` + `office_type='judicial_leader'` office + current term + `statements` (source `wikidata`, CC0). Same dry-run-first discipline. Lower coverage than cabinets; honest blanks where Wikidata is silent.

**Do a dry-run-first pass, exactly like P1–P3.** The person-creation volume and match quality are the things the owner must see before writing thousands of rows.

---

## 6. What does NOT need to change
- **No renderer rewrite.** `buildGovStructure` + `FactbookGovOrgChart` already render `office_type='cabinet'` (Executive column, rank 2) and `judicial_leader` (judicial branch). `getGovernmentStructure` already selects them. Populate rows → UI lights up. (Only the `OFFICE_RANK` one-line fix in `queries.ts` is needed for correct Leaders-list ordering.)
- **No schema change required for a v1** (one *recommended* additive `offices.display_order`; the QID-nullable posture change needs sign-off but no DDL).
- **Cabinet body already exists** for 197 countries (`"Executive of X"`) — attach offices, don't recreate.
- **Honest-data posture preserved** — every value is a real CIA (or Wikidata, for judiciary) fact; titles stored verbatim; unnamed posts render vacant, never invented; no party dot unless sourced; QID filled only when resolved.

---

## Appendix A — key file references (all absolute)
- Source (CIA): `https://www.cia.gov/resources/world-leaders/foreign-governments/<slug>/` · index `.../foreign-governments/` · archive `.../historical-data/<year>-<month>/<slug>/` · license `https://www.cia.gov/site-policies/` · `https://www.cia.gov/robots.txt`
- Renderer: `/Users/fernandobalino/Projects/civica/src/lib/factbook/gov-org-chart.ts` (`buildGovStructure`; cabinet→rank 2 at `rankOfOffice`; exec-body suppression line 328) + `/Users/fernandobalino/Projects/civica/src/components/factbook/FactbookGovOrgChart.tsx`
- Read path: `/Users/fernandobalino/Projects/civica/src/lib/db/queries.ts` (`getGovernmentStructure` ~line 174; `getLeaderTimeline` + `OFFICE_RANK` ~line 468 — the `judicial`→`judicial_leader` bug)
- Sync template (emulate): `/Users/fernandobalino/Projects/civica/src/lib/factbook/officeholders-sync.ts` (`upsertPerson`/`upsertBody`/`upsertOffice`/`upsertTerm`/`upsertStatement`, `computeEnrichmentPlan`/`reportEnrichmentPlan` dry-run split, `findJurisdiction`, `markSourcesSynced`)
- Hardcoded US/UK cabinet template (anti-pattern to replace — no provenance/freshness): `/Users/fernandobalino/Projects/civica/scripts/enrich-hierarchy.ts`
- Cron template: `/Users/fernandobalino/Projects/civica/src/app/api/cron/factbook/sync-officeholders/route.ts` + auth `/Users/fernandobalino/Projects/civica/src/lib/api/cron-auth.ts`
- Freshness: `/Users/fernandobalino/Projects/civica/src/lib/db/source-freshness.ts` (`markSourcesSynced`) · enforcement `/Users/fernandobalino/Projects/civica/scripts/validate-sync-freshness.ts`
- Sources seed: `/Users/fernandobalino/Projects/civica/scripts/seed-sources.ts` (`cia_factbook` line 13; no `cia_world_leaders` yet)
- Schema: `/Users/fernandobalino/Projects/civica/src/lib/db/schema.ts` (`government_bodies`, `offices`, `persons`, `terms`)

## Appendix B — live DB facts (read-only, 2026-07-01)
- `persons`: 351 total, **0 null `wikidata_qid`** (100%-QID invariant), 315 with photo, 27 null DOB.
- `office_type` counts: head_of_state 196, head_of_government 192, **cabinet 7**, legislative_leader 4, **judicial_leader 2**, deputy_head 1.
- `government_bodies` (branch/body_type): legislative/legislature 220, **executive/cabinet 197**, legislative/parliament 55, **judicial/judiciary 2**.
- Jurisdictions with a **cabinet body: 197**; with a **cabinet office: 2** (US, UK) — the exact gap to close.
- US: body `"Executive of United States"` (`d97fc72c…`, cabinet/executive) holds cabinet offices Secretary of State (Marco Rubio, Q324546, Republican #E91D0E), Secretary of the Treasury (Scott Bessent, Q130258582), Secretary of Defense (Pete Hegseth), Attorney General (Pam Bondi). Judiciary: body `"Supreme Court"` (`56539e87…`, judiciary/judicial), office `"Chief Justice"` (`judicial_leader`), John Roberts (Q185002).
- UK: body `"Executive of United Kingdom"` (cabinet/executive) holds Chancellor of the Exchequer / Foreign Secretary / Home Secretary (Reeves/Cooper/… Labour #E4003B). Judiciary: `"Supreme Court of the United Kingdom"`, office `"President of the Supreme Court"` (`judicial_leader`), Robert Reed (Q7345854).
- Jurisdiction join keys: US `{slug:united-states, iso2:US, iso3:USA, qid:Q30}`; UK `{slug:united-kingdom, iso2:GB, iso3:GBR, qid:Q145}`.
