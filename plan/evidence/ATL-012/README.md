# ATL-012 — organizations and memberships as dated relationships

Audit-first, per the task brief: investigate the current state, fix what is
genuinely missing and cheaply fixable without a schema migration, and
document what requires more than that.

## The system is TWO parallel, disconnected datasets

This is the load-bearing fact behind every finding below. There are two
independent representations of "which countries belong to which
organizations," and they diverge sharply:

1. **DB-backed** — `organizations` / `organization_memberships` tables
   (`src/lib/db/schema.ts:1755-1792`), read by
   `src/lib/db/queries-organizations.ts` (`getCountryOrganizationsData`) and
   `src/lib/db/queries.ts` (`getInternationalMembershipsBySlugs`). Renders on
   the country **Civica Data → Organizations** section
   (`src/components/factbook/FactbookOrganizations.tsx`) and on `/compare`.
2. **Static curated** — `MEMBERSHIPS` / `ORGANIZATIONS` arrays in
   `src/lib/data/international-organizations.ts` (a hand-authored TS module,
   not a DB table). Renders on the public org directory
   `/organizations/[slug]` (`src/components/atlas/OrgDetailPanel.tsx`) and
   backs `/api/countries/[slug]/international` (currently an **orphaned**
   public-read API route — registered in `src/lib/api/route-inventory/registry.ts`
   but no live component calls it; grep for `fetch(\`/api/countries/${...}`
   across `src/` finds only the unrelated `outcomes` route).

A reader who reaches an org via a country's Civica Data tab (DB path) and
clicks through to `/organizations/[slug]` (static path) is looking at a
**different membership roster with a different data model** for the same
organization. This split, and its consequences, drive most of the findings
below.

## Per-dimension findings

| Dimension | DB path (`organization_memberships`) | Static path (`international-organizations.ts`) |
|---|---|---|
| **Membership type** | `role: text` (nullable) — represented but mostly null (see data-quality finding) | `role: "founding" \| "permanent" \| "observer" \| null` — represented and used |
| **Start/end/status** | `join_date` only. **No end date, no status column.** Genuinely missing — schema migration required. | `joinYear` only, **before this task**. Fixed here (see below) with an app-level `status`/`endYear` field — no DB migration needed since it's a TS array, not a table. |
| **Disputed/observer** | `role` can theoretically hold `"observer"`; in practice it's `null` for the six "universal" orgs (see below) and never `"disputed"`. No disputed concept anywhere. | `"observer"` role is real and used (OIF: Kenya, Mexico, Argentina, South Korea). No disputed concept. |
| **Source/vintage** | Represented: `FactbookOrganizations.tsx` renders a footer `<SourceDot source="wikidata" retrievedAt={wikidataRetrievedAt}>`, where `wikidataRetrievedAt` traces to the real `sources.last_sync_at` row (`civica-data/page.tsx:320`). Row-level source isn't possible (`organization_memberships` has no `source_id` column), but section-level provenance is honest and live. | **Missing before this task** — `/organizations/[slug]` had zero source attribution (no `SourceDot` import in `OrgDetailPanel.tsx`). Fixed here. |
| **Org identity** | `organizations.slug/name/full_name/type/wikidata_qid` — well represented, DB-enforced unique slug. | `Organization.id/slug/name/fullName/type` — well represented, but a **separate ID namespace** from the DB (e.g. static `id: "un"` vs DB `slug: "united-nations"`; a manual `ORG_SLUG_ALIASES` map bridges DB slugs to static IDs at `international-organizations.ts:560-567`, which is itself evidence of the two-dataset split). |
| **Current vs historical** | **Not representable** — no status/end column exists. | **Missing before this task** — the code carried a comment admitting the gap ("Burkina Faso, Mali, and Niger announced withdrawal in 2024; retained here as historical members") with **no field or UI signal to act on it**: ECOWAS rendered as 15 current members. Fixed here. |

## The sharpest finding: blanket-seeded "universal" memberships (DB path, data quality, not schema)

Read-only queries against the live DB (`organizations` / `organization_memberships`,
253 total `jurisdictions` rows) show that for the six "universal" orgs — UN,
WHO, UNESCO, WTO, IMF, IAEA — **every membership row shares one `join_date`
(the org's founding date) and a `role` of `NULL`**, applied to essentially the
entire jurisdiction catalog rather than to actual member states:

- `united-nations`, `who`, `unesco`, `wto`, `imf`, `iaea` each have exactly
  **249 membership rows**, one per jurisdiction, **excluding only 4** rows
  chosen with no evident logic (Micronesia, Palestine, UAE, Central African
  Republic — all of which, notably, *are* real member states of these
  bodies, so even the exclusion set looks accidental, not principled).
- Non-sovereign/non-member entities are stamped as full members: **Taiwan**,
  **Holy See (Vatican City)**, **Antarctica**, **Akrotiri** (a UK Sovereign
  Base Area), **American Samoa**, and other dependencies/territories all
  carry `join_date = <org founding date>` UN/WHO/UNESCO/WTO/IMF/IAEA rows.
  Taiwan is not a UN member (expelled 1971); the Holy See is a UN permanent
  observer, not a member; Antarctica and Akrotiri are not sovereign states at
  all.
- Every row's `role` is `NULL` for these six orgs — no founding/permanent
  distinction is even attempted at that scale.

This is a single blanket seed ("for org X, insert a membership row for every
catalog jurisdiction, dated to the org's founding year"), not sourced
per-country accession data. It is the clearest instance of exactly what
ATL-012 warns against — a "timeless fact" stamped onto every row — and it is
**worse than merely timeless**: several of the stamped relationships never
existed. By contrast, the other 13 DB-backed orgs (NATO, EU, Council of
Europe, ASEAN, AU, GCC, ECOWAS, OECD, G7, G20, Eurozone, OIF, UNSC) have
plausible, differentiated join dates (`DISTINCT ON` join_date counts of
2–15 across those orgs vs. exactly 1 for the six universal orgs) and
correctly-sized rosters.

**This is not fixed here.** Correcting it requires DELETE/UPDATE statements
against production data — explicitly forbidden by this task's read-only
constraint (no writes, no migration). It is not a schema gap either; the
columns (`join_date`, `role`) already exist and could hold correct data. It
is a **data-correction follow-up**, most naturally scoped as its own
ticket: re-derive real UN/WHO/UNESCO/WTO/IMF/IAEA membership (with accurate
per-country accession years where available) and either delete or explicitly
flag the non-member rows for Taiwan, the Holy See, Antarctica, Akrotiri, and
other dependencies/territories currently misrepresented as full members.

## What was fixed here (no migration, no DB write)

All fixes are scoped to the **static curated dataset** (`international-organizations.ts`
is a plain TS module — extending its shape is not a schema migration) and the
components/routes that read it. The DB-backed path (`organizations` /
`organization_memberships` tables) was **not** touched — see "Deferred" below.

1. **`src/lib/data/international-organizations.ts`** — extended the
   `Membership` interface with optional `status?: "current" | "withdrawn"`
   and `endYear?: number`. Marked Burkina Faso, Mali, and Niger's ECOWAS rows
   (previously indistinguishable "founding" members) as
   `status: "withdrawn", endYear: 2025` — they jointly announced withdrawal
   in January 2024 (forming the Alliance of Sahel States) and formally exited
   in January 2025. The rows are **retained**, not deleted, so the historical
   relationship stays queryable. ECOWAS's declared `memberCount` was corrected
   from 15 (founding-era total) to 12 (current).
2. **`src/components/atlas/organizations.ts`** — added `status`/`endYear` to
   the shared `OrgMember` type.
3. **`src/app/(reader)/organizations/[slug]/page.tsx`** — passes `status`/
   `endYear` through to the rendered `OrgDetail`.
4. **`src/components/atlas/OrgDetailPanel.tsx`** (the `/organizations/[slug]`
   renderer):
   - Member rows for a withdrawn country now show an explicit **"Withdrawn"**
     badge (combined with any prior role, e.g. "Founding · Withdrawn") and a
     **`joinYear–endYear` range** (e.g. "1975–2025") instead of a bare start
     year, plus a muted row treatment (`.intl-mem-row--historical`, `opacity:
     0.62` — reuses the existing `--atlas-muted` token, no new hardcoded
     color).
   - The stat band, map fill, and regional-distribution breakdown now key off
     **current members only** (a new `currentMembers`/`formerMembers` split),
     so "Members," "Shown in Atlas," and the map's colored footprint describe
     the present-day organization, not a mix of current and historical rows.
     A conditional "Former members" stat cell replaces "Observers shown" only
     when an org actually has historical members (ECOWAS: 3); other orgs are
     unaffected (verified on NATO — see Verification).
   - Added a provenance footer (`<SourceDot source="civica_curated"
     retrievedAt={null} />` + a plain-language note) — this page previously
     had **zero** source attribution. `civica_curated` is an existing,
     correctly-classified frozen source id (`src/lib/data/sources.ts`); no new
     source was invented, and `retrievedAt={null}` is the same honest
     "not yet synced" pattern already used elsewhere for this source id
     (`src/lib/atlas/load-atlas-data.ts:392-395`).
5. **`src/app/api/countries/[slug]/international/route.ts`** — passes
   `status`/`endYear` through in the JSON response instead of silently
   coercing every membership to "current."
6. **`src/app/atlas.css`** — two small additions, both reusing existing
   design tokens (no new hardcoded values): `.intl-mem-row--historical
   { opacity: 0.62 }` and `.intl-mem-row .role-badge.historical { border-color:
   var(--atlas-muted); color: var(--atlas-muted); }`.

## Deferred (genuinely needs more than a cheap UI/API fix)

1. **DB schema migration** — `organization_memberships` has no `end_date`,
   `status`, or `disputed` column, and neither `organizations` nor
   `organization_memberships` has a `source_id` column. This blocks the
   DB-backed path (country Civica Data tab, `/compare`) from ever
   representing a withdrawal, suspension, or disputed membership, or citing a
   per-row source. Adding these columns is a schema migration and is
   explicitly out of scope for this task. Locked as a regression-test
   assertion (see below) so the gap stays visible.
2. **Blanket-seeded universal-org data** (above) — a live-data correction,
   not a schema or UI fix. Flagged as its own follow-up.
3. **Two-dataset reconciliation** — the DB path and the static path will
   keep diverging (different rosters, different ID namespaces bridged only by
   a hand-maintained `ORG_SLUG_ALIASES` map) until one is retired or they are
   merged. Out of scope here; noted because it's the root cause of several
   symptoms above.
4. Minor, low-priority: `src/lib/atlas/surface-data-matrix.ts`'s
   `route.organization-detail` row states `storage: ["organizations",
   "organization_memberships", "jurisdictions"]` and `testGap: "No dedicated
   organization-detail contract test exists."` Both are now stale — the route
   actually reads the static dataset (no DB org tables), and a contract test
   now exists (below). Left unedited to keep this task's diff scoped to the
   two datasets and their consumers; regenerating `data/atlas-surface-data-matrix.v1.json`
   is a one-line follow-up (`npm run generate:atlas-surface-data-matrix`).

## What shipped

`src/lib/data/__tests__/atl-012-organization-memberships-dated-relationships.test.ts`
— 10 pure + source-backed fixtures (no DB, no network; runs under `npm test`)
locking:

- membership type (role) is preserved, not flattened (founding/permanent/observer/plain all present);
- the OIF observer case (Kenya et al.) stays distinct from full members;
- a real dated status change (UNSC's China seat transferring in 1971, not a blanket 1945 stamp);
- ECOWAS's 3 withdrawn vs. 12 current memberships, with correct role/joinYear/endYear;
- the withdrawn relationship is visible both from the org's member list and from the country's own membership list;
- every membership resolves to a real, uniquely identified organization;
- the renderer surfaces an explicit "Withdrawn" status, a start–end year range, a muted row, and a source/vintage note;
- the API passes `status`/`endYear` through rather than coercing every row to current;
- a **deferred-gap lock**: asserts the DB `organizations`/`organization_memberships`
  Drizzle tables do NOT (yet) have `status`/`endDate`/`disputed`/`sourceId`
  columns, so this test starts failing (a deliberate signal, not a silent
  pass) the day a migration adds them — at which point this README and the
  "Deferred" section above should be updated.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run validate:design-tokens` — `✓ No new design-token drift (209 baselined legacy violations remain)` (same baseline count as before this task).
- `node --import tsx --test src/lib/data/__tests__/atl-012-organization-memberships-dated-relationships.test.ts` — 10/10 pass.
- `npm test` — 1292/1292 pass (full suite, no regressions).
- Browser-checked `/organizations/ecowas` on `localhost:3000`: Members 12,
  Shown in Atlas 12, Founding shown 10, Former members 3; map fill shows only
  the 12 current countries; Burkina Faso/Mali/Niger each render "1975–2025"
  and "Founding · Withdrawn"; provenance footer renders; zero console errors.
- Browser-checked `/organizations/nato` (an org with no historical members)
  to confirm no regression: "Observers shown: 0" still renders (the
  conditional "Former members" cell correctly does not appear), all other
  stats unchanged, zero console errors.

## Files touched

- `src/lib/data/international-organizations.ts`
- `src/components/atlas/organizations.ts`
- `src/app/(reader)/organizations/[slug]/page.tsx`
- `src/components/atlas/OrgDetailPanel.tsx`
- `src/app/api/countries/[slug]/international/route.ts`
- `src/app/atlas.css`
- `src/lib/data/__tests__/atl-012-organization-memberships-dated-relationships.test.ts` (new)

No `package.json` change was needed (no new dependency, no new npm script).
No file on the Index-protected list (`src/lib/ci/index-change-control.ts`)
was touched or needed touching.
