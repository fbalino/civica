# ATL-013 — bills/legislative-activity coverage audit

Audit-first, per the task brief: investigate the current state, fix what is
genuinely missing and cheaply fixable without a schema migration or DB write,
and document what requires more than that.

## The supported-jurisdiction set

Bills sync only runs for six jurisdictions, each with its own cron under
`src/app/api/cron/bills/{us,uk,ca,de,fr,br}/route.ts` → `runBillsSync`:

| Slug | ISO2 | Adapter | `bills.source_id` |
|---|---|---|---|
| `united-states` | US | `src/lib/bills/sources/us-congress.ts` | `congress_gov` |
| `united-kingdom` | GB | `src/lib/bills/sources/uk-parliament.ts` | `uk_parliament` |
| `canada` | CA | `src/lib/bills/sources/legisinfo-ca.ts` | `legisinfo_ca` |
| `germany` | DE | `src/lib/bills/sources/bundestag-dip.ts` | `bundestag_dip` |
| `france` | FR | `src/lib/bills/sources/an-senat-fr.ts` | `data_assemblee_fr`, `senat_fr` |
| `brazil` | BR | `src/lib/bills/sources/camara-senado-br.ts` | `camara_br`, `senado_br` |

That is 6 of 194 sovereign states (`jurisdiction-status/v1` denominator) —
confirmed both by reading the six cron files and by a read-only live-DB count
(`SELECT j.slug, COUNT(*) FROM bills b JOIN jurisdictions j ...`): exactly
those six slugs have any `bills` rows at all (United States 3,974; Brazil
1,890; United Kingdom 446; France 394; Germany 152; Canada 137). This set is
now the single source of truth `src/lib/bills/coverage.ts` —
`BILLS_SUPPORTED_JURISDICTIONS` — derived from and locked against the real
cron files by `src/lib/bills/__tests__/atl-013-bills-coverage.test.ts`.

## Per-dimension findings

| Dimension | Before this task | After this task |
|---|---|---|
| **Source** | Already honest. `SOURCE_TAG`/`SOURCE_ID` per-row label (e.g. "U.S. Congress") in both `FactbookBills.tsx` and the API route, plus a `<SourceDot>` tied to `sources.last_sync_at`. | Unchanged in substance; both files now import the single `BILLS_SOURCE_LABELS` map from `coverage.ts` instead of two independent, driftable copies. |
| **Chamber** | **Missing from every rendered surface.** `bills.body_id` (FK → `government_bodies`) is populated by the DE/FR/BR/CA adapters (confirmed live: 100% of rows for those four have a non-null `body_id`, resolving to real chamber names — "German Bundestag", "Federal Senate", "Chamber of Deputies", "House of Commons", "Senate", "National Assembly") but was never joined or displayed. US/UK adapters hard-code `bodyId: null` — US chamber is only inferable from the bill-type prefix already inside the title ("H.R." vs "S."); UK's raw API exposes `currentHouse` but the adapter drops it before it reaches the DB. | Fixed for DE/FR/BR/CA: `FactbookBills.tsx` and the API route now join `government_bodies` and render/return a chamber chip (e.g. `German Bundestag (lower)`). **Genuinely deferred for US/UK**: recovering chamber there needs an ingest-adapter change (parse the US title prefix into a real field, or map UK's `currentHouse`) plus a live resync — out of this task's read-only-DB, no-adapter-resync scope. Documented, not silently left unmentioned. |
| **Status taxonomy** | Partially honest. The 0–4 stage scale (`src/lib/bills/stage.ts`) was already rendered as a 5-label timeline (`Draft/Committee/Lower Floor/Upper House/Enacted`), but the publisher's own raw status text (`rawStatus`, e.g. "Placed on the Union Calendar, Calendar No. 625.") was captured in the DB and returned by the API's `status` field but **never rendered** on the Bills UI — a reader saw only the abstract stage, not what the source actually said. | Fixed: both the abstract stage timeline/labels AND the verbatim `rawStatus` text now render per bill (`Status: {rawStatus}`). `BILLS_STAGE_LABELS` centralized in `coverage.ts` and cross-checked by test against the schema's documented `0=draft,1=committee,2=floor,3=passed,4=enacted` comment. |
| **Date semantics** | **Missing.** `introducedDate` exists in the schema/`BillIngest` type and is populated for legisinfo_ca, bundestag_dip, senat_fr, senado_br (not for camara_br or data_assemblee_fr — the publishers don't expose it, consistent with the 7.7%-complete field in `/methodology/source-coverage`), but `FactbookBills.tsx` only ever rendered `lastActionDate` under the ambiguous label "Last action" — a reader couldn't tell a brand-new bill from a years-old one with one recent action. | Fixed: `Introduced {date}` now renders alongside `Last action {date}` whenever `introducedDate` is present, and the API route now returns `introducedDate` (it previously silently dropped it from the response). |
| **Pagination** | **Missing.** Both surfaces hard-cap at 20 (`FactbookBills.tsx`) / 10 (API route) most-recent rows with **no visible total** — live counts range from 137 (Canada) to 3,974 (United States); a reader had no way to know they were seeing 0.5% of a jurisdiction's tracked bills. | Fixed: both surfaces now query the real per-jurisdiction total and disclose it ("Showing the 20 most recent of 3,974 tracked United States bills"; API `coverage.totalTrackedForJurisdiction`). |
| **Freshness** | Already honest. Per-row `<SourceDot retrievedAt={sources.last_sync_at}>` in `FactbookBills.tsx`; the parent `civica-data/page.tsx`'s `SourcesStrip` also shows the Bills section's source names + `last_sync_at` dates. The generated `/methodology/source-coverage#bills` report additionally publishes per-source-family `lastSuccessfulRun` timestamps (all 6 jurisdictions' 8 source families, generated from a live DAT-020 audit). | Unchanged (already correct); `FactbookBills.tsx` now links to `/methodology/source-coverage#bills` from its new coverage banner so the freshness detail is one click away in-context. |
| **Jurisdiction coverage** | Published at a domain level (not bills-specific): `/methodology/source-coverage#bills` (DAT-020, generated from a live audit) already states `jurisdictionsCovered: 6`, `eligibleJurisdictions: 194`, `countryCoveragePercent: 3.1`, and field-completeness numbers — but it does **not name which six** jurisdictions, and nothing on the Bills section itself named them either. | Fixed for supported countries: `FactbookBills.tsx` now opens with a banner naming all six jurisdictions and linking to the domain report. Fixed for the API: `coverage.supportedJurisdictions` is always present. **Still not fixable in-context for a reader who lands on an unsupported country's Civica Data tab** — see next row. |
| **Unsupported-country explanation** (the task's stated top priority) | The whole numbered "Bills" section (sidebar entry + content block) is **entirely absent**, not misleadingly empty, for an unsupported country — verified live: `/country/japan/civica-data` has no "Bills" anywhere in the DOM or sidebar nav. This is more honest than a fake empty legislature, but it also means a reader gets **zero explanation**, not even a hint that a Bills capability exists for other countries. | **Fixed for the public API** (`/api/countries/[slug]/bills`, previously an orphaned-but-documented public-read endpoint returning a bare `{bills: []}`): now returns an explicit `coverage: {supported: false, supportedJurisdictions: [...], message: "...an empty list here reflects missing coverage, not an absence of legislative activity."}` for any jurisdiction outside the set — verified live against `/api/countries/japan/bills`. **Genuinely blocked, and documented as a deferral, for the Civica Data tab UI** — see below. |

## Why the in-tab explanation for unsupported countries is deferred

The whole-section visibility (both the sidebar nav entry "07 · Bills" and the
numbered content block) is computed once, in
`src/app/(reader)/country/[slug]/civica-data/page.tsx`:

```ts
const hasBills = !!billsResult && billsResult.rows.length > 0;
// ...
case "bills":
  return hasBills;
// ...
const visibleSections = SECTION_PLAN.filter((s) => isVisible(s.id));
```

`visibleSections` drives both `sidebarItems` and the `CivicaDataSections`
content list — so when `hasBills` is `false`, the Bills section (and any
coverage explanation `FactbookBills.tsx` might render) never reaches the DOM
at all, regardless of what the child component does.

Both `civica-data/page.tsx` and `billsResult`'s source,
`getBillsForJurisdiction` in `src/lib/db/queries.ts`, are listed in
`INDEX_PROTECTED_FILES` (`src/lib/ci/index-change-control.ts`, `"presentation"`
and `"input"` categories respectively) — confirmed by
`src/lib/bills/__tests__/atl-013-bills-coverage.test.ts`. Editing either file
triggers the Index-change-control hash-chain/version-bump ceremony (built for
methodology-grade Civica Index/Pulse changes) even though this particular
edit is presentation-only and has nothing to do with Index scoring. Per the
task's explicit instruction, neither protected file was touched here.

**What a follow-up would need to do**, once change-control sign-off is
obtained (or an owner-approved exception for non-Index edits to this file):
change `hasBills` in `civica-data/page.tsx` to something like `!!billsResult`
(jurisdiction found, regardless of row count) so the section is always
present, and have `FactbookBills.tsx` render the coverage explanation instead
of `return null` when `result.rows.length === 0`. `FactbookBills.tsx` already
has everything else it needs for that path (`billsCoverageMessage()` in
`coverage.ts` — the unsupported-country copy, already used correctly by the
API route and locked by a regression test so it can't silently apply to a
supported country by mistake).

## What was fixed (no migration, no DB write, no protected file touched)

1. **`src/lib/bills/coverage.ts` (new)** — single source of truth for the
   six-jurisdiction set (derived from and tested against the real cron
   files), the shared source-id → label map, the 0–4 stage labels, and two
   distinct coverage-copy functions (`billsCoverageMessage` for unsupported
   countries, `billsSupportedCoverageNote` for supported ones — kept
   deliberately separate after an early draft bug, see below).
2. **`src/components/factbook/FactbookBills.tsx`** — adds a chamber join
   (`government_bodies`), an `Introduced {date}` field, the publisher's raw
   status text, a shown-vs-total pagination line, and a jurisdiction-coverage
   banner (`<Banner variant="info">`, the canonical primitive) linking to
   `/methodology/source-coverage#bills`. Reuses the existing
   `.factbook-bill-tag`/`.factbook-bill-meta` classes — no new CSS, no new
   hardcoded values (`npm run validate:design-tokens` stays at the 209
   baselined violations, zero new).
3. **`src/app/api/countries/[slug]/bills/route.ts`** — same chamber/date/
   pagination additions, plus the `coverage` object described above for
   every response (supported or not).
4. **`src/lib/bills/__tests__/atl-013-bills-coverage.test.ts` (new)** — 11
   source-backed + pure fixtures (see Verification).

## A bug caught and fixed during this task

An early draft of `FactbookBills.tsx` reused the unsupported-country
`billsCoverageMessage()` function unconditionally — which produced, on a
live United States page, the self-contradictory banner *"...United States,
United Kingdom, Canada, Germany, France, Brazil. **This jurisdiction is not
yet in that set**..."* on a page that plainly has bills. Caught by the
required live browser check (not by `tsc`/tests, since both functions
type-checked fine). Fixed by splitting into `billsCoverageMessage`
(unsupported copy, used only by the API route) and
`billsSupportedCoverageNote` (supported copy, used only by
`FactbookBills.tsx`), with a regression test
(`billsSupportedCoverageNote ... never claims non-coverage`) asserting the
supported-country copy never contains "not yet in that set" or "is not".
This is exactly the class of bug ATL-013 exists to prevent, which made it
worth fixing immediately rather than shipping.

## Verification

- `npx tsc --noEmit` — clean.
- `node --import tsx --test src/lib/bills/__tests__/atl-013-bills-coverage.test.ts` — 11/11 pass.
- `node --import tsx --test "src/lib/bills/**/*.test.ts"` — 18/18 pass (includes pre-existing sync/upsert/source-fixture suites, unaffected).
- `node --import tsx --test "src/lib/api/**/*.test.ts"` — 69/69 pass (route-inventory/contract suites unaffected by the response-shape change).
- `npm test` (full repo suite) — 1303/1303 pass, no regressions.
- `npm run validate:design-tokens` — "No new design-token drift (209 baselined legacy violations remain)."
- **Browser, supported country** (`localhost:3000/country/united-states/civica-data?section=bills`): "07 · Bills" renders with a coverage banner ("...currently covers six jurisdictions: United States, United Kingdom, Canada, Germany, France, Brazil. Showing the 20 most recent of 3,974 tracked United States bills. See the source coverage report..."), 20 bills each with source tag, `SourceDot`, "Last action" date, raw status text, stage timeline, "Official Text" link. No console errors.
- **Browser, supported country with chamber data** (`localhost:3000/country/germany/civica-data?section=bills`): first bill shows tags `["Bundestag", "German Bundestag (lower)"]` and metas `["Introduced 2026-05-08", "Last action 2026-05-29", "Status: Verkündet", "Sponsor: Bundesregierung"]` — chamber, both dates, and raw status all present. No console errors.
- **Browser, unsupported country** (`localhost:3000/country/japan/civica-data`): confirmed via DOM query — `document.getElementById('bills')` is `null`, the word "Bills" does not appear anywhere on the page or in the sidebar nav (`billsSectionExists: false`, `bodyHasBillsWord: false`). This is the documented, deferred structural gap — silent absence, not a misleading empty legislature, but also not yet the in-context explanation the task asks for (see deferral above).
- **API, unsupported country**: `fetch('/api/countries/japan/bills')` → 200, `{"country":"Japan","bills":[],"coverage":{"supported":false,"supportedJurisdictions":["United States","United Kingdom","Canada","Germany","France","Brazil"],"totalTrackedForJurisdiction":0,"message":"Civica's bills/legislative-activity pipeline currently covers six jurisdictions (...). Japan is not yet in that set — an empty list here reflects missing coverage, not an absence of legislative activity."}}`.
- **API, supported country**: `fetch('/api/countries/united-states/bills')` → 200, `coverage.supported: true`, `coverage.message: null`, `coverage.totalTrackedForJurisdiction: 3974`, sample row has `chamber: null` (US genuinely has no chamber data) and `stageLabel: "Lower Floor"`.

## Deferred (genuinely needs more than this task's scope)

1. **US/UK chamber** — needs an ingest-adapter change (parse US title
   prefix or map UK's `currentHouse`) plus a live resync to populate; out of
   a read-only-DB, no-adapter-resync task.
2. **Unsupported-country in-tab explanation** — structurally blocked by two
   Index-change-control-protected files (`civica-data/page.tsx`,
   `queries.ts`); exact minimal fix documented above for a follow-up task
   once change-control sign-off is obtained.
3. **Naming the six jurisdictions inside the generated `/methodology/source-coverage`
   domain report itself** (it currently gives counts, not names, for every
   domain — not a bills-specific gap) was left alone: regenerating that
   checked artifact touches all nine domains and its own generator/type
   contract, disproportionate to a bills-scoped task when the six names are
   now published in-context on every supported country's Bills section and
   in the API's `coverage.supportedJurisdictions`.
