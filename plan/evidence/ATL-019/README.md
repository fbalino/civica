# ATL-019 — stable entity identifiers & citations

Status: implemented and verified (static + live, read-only). Not committed —
per task instructions the caller commits.

## What this is

A single generic citation contract, `stable-entity-citation/v1`, for the
eight ATL-019 entity kinds: fact, institution, office, person, election,
constitution-passage, organization, indicator. Every kind resolves at
`GET /api/citations/{entityType}/{id}`, where `id` is a persistent
Postgres primary key (UUID) or content digest — **never** a mutable display
column. `constitution-passage` reuses the already-shipped sha256
content-digest identity from `src/lib/constitution/passage-index.ts` /
`/api/constitution/passages/[digest]` rather than inventing a second
identity scheme for the same rows.

## Files created

- `src/lib/citations/stable-identity.ts` — the discriminated `EntityCitation`
  type, the closed `ENTITY_TYPES` enum, per-kind id-format regexes,
  `buildCitationUrl`, `deriveRevisionRelease` (DAT-016 leg),
  `deriveHeuristicSourceId`, and the strict Zod schema
  (`zEntityCitation` = `z.discriminatedUnion("entityType", …)`).
- `src/lib/citations/resolvers/shared.ts` — `fetchSourceCitation` (sources
  table lookup), `fetchRevisionRelease` (DAT-016
  `research_evidence_history` lookup), `toIsoOrNull`/`nowIso`.
- `src/lib/citations/resolvers/fact.ts` — `country_facts.id`.
- `src/lib/citations/resolvers/institution.ts` — `government_bodies.id`.
- `src/lib/citations/resolvers/office.ts` — `offices.id`.
- `src/lib/citations/resolvers/person.ts` — `persons.id`.
- `src/lib/citations/resolvers/election.ts` — `elections.id`.
- `src/lib/citations/resolvers/constitution-passage.ts` — adapts the shipped
  `constitution_passages.passage_id` digest; does not re-derive the hashing
  scheme or the rights gate.
- `src/lib/citations/resolvers/organization.ts` — `organizations.id`.
- `src/lib/citations/resolvers/indicator.ts` — `country_metrics.id`.
- `src/lib/citations/resolvers/index.ts` — closed `entityType -> resolver`
  dispatch table shared by the route and the live validator.
- `src/app/api/citations/[entityType]/[id]/route.ts` — Next 16 async-params
  route; closed-enum 404, per-kind id-format 404, strict Zod parse of the
  resolver's output before it ever leaves the server.
- `src/lib/citations/stable-identity.test.ts` — 24 `node:test` cases: enum/
  pattern invariants, the two pure helpers, one shape+Zod test per entity
  kind, and one genuine **rename round-trip** test per entity kind.
- `scripts/validate-stable-identifiers.ts` — DB-free static Drizzle-schema
  introspection (`getTableConfig`) proving each kind's identity column is a
  real primary key, not a display column; `--live` additionally resolves one
  real row per kind against production (read-only SELECTs only).

## Files modified (housekeeping, not core to the task)

- `src/lib/api/route-inventory/registry.ts` — registered the new public GET
  route in the PLT-008 inventory (`exposure: "public-read"`, `controls:
  ["public"]`, matching the existing `/api/constitution/passages/[digest]`
  entry), and bumped the route-count doc comment 99 → 100.
- `src/lib/api/route-inventory/__tests__/route-inventory.test.ts` — bumped
  the two hardcoded route-count assertions 99 → 100 to match the real
  filesystem count after adding the new route (`npm test` fails otherwise —
  this is expected maintenance whenever any route.ts is added, unrelated to
  ATL-019's substance).

`package.json` was **not** edited (forbidden). Add these two lines by hand,
next to the other `validate:*` entries:

```json
"validate:stable-identifiers": "tsx scripts/validate-stable-identifiers.ts",
"validate:stable-identifiers:live": "tsx scripts/validate-stable-identifiers.ts --live",
```

## Verification

### `npx tsc --noEmit`

Clean, no output, exit 0. Re-checked after the route-inventory edits too.

### `node --import tsx --test src/lib/citations/stable-identity.test.ts`

```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

### `npx tsx scripts/validate-stable-identifiers.ts` (static, DB-free)

```
Static: 8/8 entity kinds have a schema-verified stable-primary-key identity.

PASS — stable-entity-citation/v1 identifiers are primary-key/digest bound for all 8 entity kinds.
```

### `npx tsx scripts/validate-stable-identifiers.ts --live` (read-only)

```
Static: 8/8 entity kinds have a schema-verified stable-primary-key identity.

Live (read-only):
  fact                  id=4704dfd1-dfd1-4440-b732-… -> https://civicaatlas.org/api/citations/fact/4704dfd1-dfd1-4440-b732-6897e1fe29a3
  institution           id=139b8691-11f7-473b-8681-… -> https://civicaatlas.org/api/citations/institution/139b8691-11f7-473b-8681-497d6db8cf13
  office                id=92ce9452-85a7-4652-a7a3-… -> https://civicaatlas.org/api/citations/office/92ce9452-85a7-4652-a7a3-28f6c05d451c
  person                id=06b109cc-4457-4331-9038-… -> https://civicaatlas.org/api/citations/person/06b109cc-4457-4331-9038-739cedd72d18
  election              id=655b7cb9-4763-424d-9e60-… -> https://civicaatlas.org/api/citations/election/655b7cb9-4763-424d-9e60-ca1307cc89dc
  constitution-passage  id=sha256:8ab5907f85be882bf… -> https://civicaatlas.org/api/citations/constitution-passage/sha256:8ab5907f85be882bf49ef628563c790c32a2f99dacd22f2e2b520d38636c2704
  organization          id=df52a846-0470-4265-8c05-… -> https://civicaatlas.org/api/citations/organization/df52a846-0470-4265-8c05-af1dde91ab63
  indicator             id=1642a949-de1b-4671-b8b1-… -> https://civicaatlas.org/api/citations/indicator/1642a949-de1b-4671-b8b1-5dced2a6170e

PASS — stable-entity-citation/v1 identifiers are primary-key/digest bound for all 8 entity kinds; live resolution verified against production.
```

Every real row: resolves non-null, echoes the requested id back
(`citation.id === requested id`), builds the exact canonical
`citationUrl`, strict-Zod-parses, and carries the release/version/source leg
appropriate to its kind (fact/indicator assert `source.sourceId` is set;
institution/office/person/election assert the DAT-016
`retentionContractVersion` is the live `research-evidence-retention/v1`
contract; constitution-passage asserts `source.sourceId ===
"constitute_project"` with a non-null license). No write ever executes —
every query in every resolver is a `SELECT`.

### `node --import tsx --test src/lib/api/route-inventory/__tests__/route-inventory.test.ts`

17/17 pass after the count bump.

### Full suite: `node --import tsx --test "src/**/*.test.ts" "scripts/**/*.test.ts"`

1166/1167 pass. The one failure — `src/lib/ci/index-change-control.test.ts`
("current Index change-control baseline is complete") — is **pre-existing
and unrelated to ATL-019**: `git status` shows a batch of uncommitted
modifications to files this session never touched (e.g.
`src/components/factbook/FactbookHeaderStrip.tsx`,
`src/app/rankings/RankingsMatrix.tsx`, `DESIGN.md`, several other
components), and both of those two files are on the Index change-control
protected list. That drift — not this task's changes — is what trips the
baseline-hash check. None of ATL-019's new/edited files
(`src/lib/citations/**`, `src/app/api/citations/**`,
`scripts/validate-stable-identifiers.ts`,
`src/lib/api/route-inventory/registry.ts`,
`src/lib/api/route-inventory/__tests__/route-inventory.test.ts`) appear on
the protected-files list, and AGENTS.md explicitly forbids touching the one
protected file this task could plausibly have brushed
(`src/app/(reader)/country/[slug]/civica-data/page.tsx`) — left untouched.

## Coverage table

| Entity kind | Table | Stable id | id example | Release/version/source leg | Reader deep link |
|---|---|---|---|---|---|
| fact | `country_facts` | `id` (uuid PK) | `country_facts.id` | native: `source_id` -> `sources`, `as_of`, `upstream_vintage_label`, `retrieved_at` | `/country/{slug}` |
| institution | `government_bodies` | `id` (uuid PK) | `government_bodies.id` | DAT-016 `research_evidence_history`; source heuristic (`ipu_parline_id` / `wikidata_qid`) | `/country/{slug}/civica-data` |
| office | `offices` | `id` (uuid PK) | `offices.id` | DAT-016 `research_evidence_history`; source heuristic (`wikidata_qid`) | `/country/{slug}/civica-data` |
| person | `persons` | `id` (uuid PK) | `persons.id` | DAT-016 `research_evidence_history`; source heuristic (`wikidata_qid`) | `/country/{slug}/civica-data` (via current term) or `null` |
| election | `elections` | `id` (uuid PK) | `elections.id` | DAT-016 `research_evidence_history`; source heuristic (`wikidata_qid`) | `null` (no precise per-election page exists yet) |
| constitution-passage | `constitution_passages` | `passage_id` (text PK, `constitution-passage/sha256:<hex>`; shipped) | `sha256:<hex>` (bare digest, URL-safe segment) | native: `source_id='constitute_project'` -> `sources`; `is_current`/`superseded_at` | `/constitution?c={slug}#{anchor}` when current, else `null` |
| organization | `organizations` | `id` (uuid PK) | `organizations.id` | source heuristic (`wikidata_qid`); no DAT-016 leg (table not in the retained-relations registry) | `/organizations/{slug}` |
| indicator | `country_metrics` | `id` (uuid PK) | `country_metrics.id` | native: `source_id` -> `sources`, `created_at` | `/country/{slug}/civica-data` |

## Rename round-trip proof

Each resolver factors a pure `buildXCitation(row, source, …)` with no DB
access (`resolveXCitation` only fetches rows and hands them to the pure
builder). `src/lib/citations/stable-identity.test.ts` proves the contract
directly for all 8 kinds: build a citation from a row, mutate ONLY the row's
display column, rebuild, and assert `id`/`citationUrl` are byte-identical
while `label` changes.

Example (fact — full case is in the test file):

```ts
const before = buildFactCitation({ ...row, jurisdictionName: "Oriental Republic of Uruguay" }, source, at);
const after  = buildFactCitation({ ...row, jurisdictionName: "Republica Oriental del Uruguay" }, source, at);
assert.equal(before.id, after.id);                 // unchanged
assert.equal(before.citationUrl, after.citationUrl); // unchanged
assert.notEqual(before.label, after.label);         // display text DID change
```

The same pattern is asserted for: institution (`government_bodies.name`),
office (`offices.name`), person (`persons.name`), election
(`elections.election_name`), constitution-passage
(`heading_label`), organization (`organizations.full_name`), and indicator
(`metric_definitions.name`).
