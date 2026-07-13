# ATL-012 — dated organization memberships

**Release:** `organization-membership-release/2026-07-v1`

**Evidence retrieved:** 2026-07-12

**Status:** implemented in code and production; live validation passes

## Decision

Organization membership is an interval with a source, not a timeless country
attribute. Public readers use only checked relationships. The former blanket
seed remains in the database as `unverified_legacy` audit evidence and is
excluded at every public read boundary.

The release contains 23 organization identities and 446 retained
relationships:

- 443 current and 3 withdrawn relationships in the static reference release;
- 445 database relationships because Western Sahara is a named fallback entity
  outside the current jurisdiction table;
- 442 current and 3 withdrawn database relationships;
- 9 complete rosters and 14 selected checked subsets.

An absent country in a selected subset is not a non-membership claim.

## Storage contract

Authoritative migration `0032_sparkling_genesis` adds the following fields:

- organization identity source ID, exact URL, rights text, retrieval time, and
  upstream vintage;
- membership join/end dates and date precision;
- current, former, withdrawn, suspended, or `unverified_legacy` status;
- membership role, dispute flag, and status note;
- membership source ID, exact URL, rights text, retrieval time, and upstream
  vintage.

Database checks reject unsupported public status values, terminal
relationships without an end date, impossible intervals, and public rows
without a complete source bundle. Existing rows defaulted to
`unverified_legacy`; the migration did not declare any legacy relationship
current.

The migration was rehearsed against a production-shaped PostgreSQL clone with
1,713 legacy relationships. All entered quarantine, none entered the public
set, and a forced current row without provenance was rejected. The production
ledger now records all 33 authoritative migrations and matches schema
fingerprint
`7253b6ca45e88d1c358d62a832c359c9066a25775e43db1e911de8501a6b6c4f`.

## Release writer

`scripts/sync-organization-memberships.ts` is the only supported writer. It
uses one native Neon transaction containing five statements:

1. source-record upsert;
2. 23 organization-identity upserts;
3. quarantine of prior rows in the released organizations;
4. 445 checked relationship upserts;
5. the sanctioned source-freshness stamp.

The destructive `scripts/seed-organizations.ts` path is retired and fails
loudly. It cannot recreate the former `__un_all__` blanket memberships.

The production activation quarantined 1,695 prior rows before activating the
checked relationships. The final table contains 442 current, 3 withdrawn, and
1,435 `unverified_legacy` rows. The evidence-retention trigger preserves
before/after state for corrected rows.

## Source and rights contract

Each organization points to its exact official roster or member-state page.
Examples include:

- [United Nations Member States](https://www.un.org/en/about-us/member-states)
- [WHO countries](https://www.who.int/countries)
- [WTO members and observers](https://www.wto.org/english/thewto_e/whatis_e/tif_e/org6_e.htm)
- [IAEA INFCIRC/2/Rev.92](https://www.iaea.org/sites/default/files/publications/documents/infcircs/1959/infcirc2r92.pdf)
- [ECOWAS Member States](https://www.ecowas.int/member-states/)

`civica_organization_roster_v1` is registered as a manual Atlas production
adapter and source-input specification. Its mixed publisher terms remain
pending in the rights manifest, so both current and historical organization
rows stay outside the public bulk export. The export fixture records this as
`excluded_surface_only`; the website and JSON API retain the full relationship
state and source bundle.

The operational source-coverage report now counts only current, source-backed
relationships. It reports 23 released organizations covering 163 sovereign
states, with the selected-roster limitation visible. Legacy blanket rows no
longer inflate that measure.

## Public behavior

- `/organizations/[slug]` shows current counts and map coverage separately
  from withdrawn rows. ECOWAS shows 12 current and 3 former members, with
  `1975–2025` intervals for Burkina Faso, Mali, and Niger.
- WHO and other selected rosters show an explicit partial-coverage note.
  Unsupported accession-year placeholders are suppressed rather than shown as
  organization founding dates.
- The country Civica Data section shows current and historical counts,
  relationship status, interval, exact source link, and release vintage.
- `/compare` distinguishes current and withdrawn relationships and parses
  year-precision dates in UTC, preventing timezone year shifts.
- `/api/countries/[slug]/international` accepts canonical country slugs and
  ISO3 codes. Every relationship includes status, interval, source URL,
  retrieval time, release vintage, license posture, and roster coverage.
- Atlas aggregate membership labels include current checked relationships
  only. Co-membership counts exclude withdrawn rows.

## Live invariants

`npm run validate:organization-memberships:live` verifies:

- 23 sourced organization identities;
- 445 released database relationships: 442 current and 3 withdrawn;
- zero public relationships with incomplete provenance;
- 12 current and 3 withdrawn ECOWAS relationships;
- Kenya retained as an OIF observer;
- no public UN/WHO/UNESCO/WTO/IMF/IAEA membership for Taiwan or Antarctica;
- the source freshness timestamp matches the frozen retrieval time;
- legacy evidence remains retained.

## Verification

- `npm run validate:organization-memberships` — pass
- `npm run validate:organization-memberships:live` — pass
- `npm run validate:authoritative-migrations:live` — 33/33 and fingerprint
  match
- `npm run validate:source-coverage` and
  `npm run audit:source-coverage:live` — pass
- `npm run validate:source-input-manifest` — pass
- `npm run validate:rights-manifest` — pass
- `npm run validate:sync-freshness` — pass
- second application of `npm run sync:organization-memberships` — exact
  release match, zero writes, no freshness restamp
- `npm run validate:data-dictionary` — pass
- `npm run validate:design-tokens` — no new drift
- focused ATL-012 suite — 14/14 pass
- `npm run validate:research-evidence-retention` — 36 protected relations,
  pass after removing the retired seeder from the destructive-path registry
- `npm run validate:g2-atlas` and `npm run reproduce:g2-atlas` — pass; the
  frozen release remains 253 jurisdictions, 12,373 facts, and 3 exportable
  sources after its embedded rights inventory was refreshed
- isolated full `npm test` — 1,357 pass, 0 fail, 3 intentionally skipped
- isolated end-to-end `npm run build` — pass, including the aggregate claims
  gate, its full 1,360-test run, Turbopack, TypeScript, and 108 generated pages

Browser checks at `localhost:3200` covered desktop and mobile ECOWAS,
selected-roster WHO, Ghana current memberships, Burkina Faso historical
membership, the Ghana/Burkina Faso comparison, and the public JSON API. The
browser pass found and closed two regressions before release: timezone-shifted
year intervals in `/compare`, and empty API responses for canonical country
slugs outside the small in-memory catalog.

## Remaining limitation

Fourteen rosters remain selected subsets. ATL-012 makes that missingness
honest and prevents false claims; it does not claim complete global membership
coverage. Expanding those rosters requires captured official inputs and a new
versioned release.
