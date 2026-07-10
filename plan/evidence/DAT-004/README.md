# DAT-004 evidence — sourced jurisdiction-status taxonomy

Status: implementation complete and applied on 2026-07-10.

## Outcome

`jurisdiction-status/v1` replaces the live database's blanket classification of
all 253 reference rows as sovereign states. The closed taxonomy now contains:

- 194 sovereign states: 193 current UN members plus the Holy See on its own
  sourced observer-state path
- 47 dependencies or territories
- 2 self-governing associated states: Cook Islands and Niue
- 8 disputed or limited-recognition entities/areas
- 2 aggregate or special-area records

Every live row now carries source IDs, a review date, neutral status note,
administering-jurisdiction ISO3 where applicable, and a dispute flag. Only
`sovereign_state` is countable in sovereign-state totals. The taxonomy never
uses ISO/M49 coding, page existence, or Atlas inclusion as a blanket sovereignty
rule.

## Sources and political-status discipline

- United Nations Member States supplies the closed 193-member inventory.
- United Nations Non-Member States supplies the observer-state status of the
  Holy See and State of Palestine.
- UN M49 is used for identity/statistical-area reference and explicitly not as
  a sovereignty determination.
- The frozen January 2026 CIA World Factbook profiles supply dependency,
  administering-state, territorial, and special-area descriptions.
- New Zealand Ministry of Foreign Affairs and Trade pages supply the Cook
  Islands and Niue free-association status.

Limited-recognition and disputed entries use neutral wording. The classification
records Civica's display/counting policy without claiming to settle sovereignty.

## Enforcement

- `src/lib/jurisdictions/status-taxonomy.ts` contains the five-class vocabulary,
  closed inventories, source registry, row classifier, and type-specific display
  policy.
- Unknown ISO3 codes and unknown slugs throw instead of defaulting sovereign.
- `scripts/seed-from-factbook.ts` now classifies every upsert and persists the
  status fields.
- `drizzle/migrations/0020_jurisdiction_status_taxonomy.sql` adds and backfills
  the fields transactionally, aborts on an unknown row or non-253 catalog, makes
  source/review/note non-null, and adds the five-value database constraint.
- `npm run validate:jurisdiction-status` is the DB-free build guard.
- `npm run audit:jurisdiction-status:live` compares every live row against the
  canonical classifier.

## Verification

- The forward migration applied as one 11-statement Neon transaction.
- The live audit passed all 253 rows with zero missing status fields.
- Eight focused fixtures cover UN-member and observer paths, Cook Islands/Niue,
  Puerto Rico, Taiwan, Western Sahara, Antarctica, the grouped US island row,
  Falkland dispute metadata, unknown-entry rejection, sources, and display
  counting policy.
- `/api/v1/countries?limit=250` returned `total: 194`, included France, and
  excluded Puerto Rico from the sovereign-state catalog.
- TypeScript, focused ESLint, design-token validation, claims/docs, 383 tests,
  browser checks, production build, and master-plan validation passed.

ATL-006 owns the later Fable-led presentation of these fields across search,
country/territory profiles, Atlas, compare, metadata, sitemap, API, and exports.
