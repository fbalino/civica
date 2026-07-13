# ATL-011 — party identity and provenance closure

Status: acceptance gates satisfied on 2026-07-13.

## Result

The party browser now rests on three separate records:

- `political_parties` holds canonical party identity.
- `legislature_parties` holds a retained, soft-retired participation row for
  one party in one chamber.
- `party_composition_runs` holds the immutable source retrieval supporting the
  displayed name, color, seats, and coalition status.

`party_identity_events` is an append-only ledger for adoption, rename,
retirement, reactivation, split, merge, and succession evidence. Composition
syncs do not infer lineage from name similarity or disappearance. A split,
merge, or succession edge can be written only with distinct party identities
and an explicit source, URL, license, and retrieval time.

## Acceptance record

| Requirement | Evidence |
|---|---|
| Every displayed party attribute has source, vintage, and license | The browser's Composition source covers the source payload supplying name, color, seats, and coalition status. A V-Party source row covers each displayed ideology position and shows its coding year. Both entries show a linked source, retrieval month, license, and `SourceDot`. An incomplete legacy source tuple renders `Composition source not recorded`. |
| Identity changes and splits are versioned | Migration `0031_hot_saracen.sql` adds stable identities, retained chamber rows, immutable source runs, and append-only identity events. The pure planner preserves UUIDs on refresh and rename, soft-retires missing rows, and never manufactures a split. Explicit split/merge/succession writes require sourced evidence. |
| Unknown ideology is not inferred | Only complete, high-confidence V-Party matches resolve to a position. Review-confidence, incomplete, non-competitive, and unmatched rows resolve to `null` and render `Ideology not recorded`. |
| Visualization uses an adopted external method or remains absent | The existing compass uses the adopted V-Party v2 economic-left/right and anti-pluralism measures. Parties without an eligible external observation are not plotted. |

## Production migration and invariants

The authoritative migration was rehearsed against a disposable PostgreSQL 17
copy before being applied to Neon. It preserved all existing
`legislature_parties` UUIDs and all 656 `party_positions` foreign-key links.
The production schema now matches the checked authoritative fingerprint
`2cfee24652103889f6d08939a39d59ae6408ec7c3f63b5f14871ba8e56e3babc`.

Live validation after migration:

- 1,548 canonical party identity rows
- 1,548 current chamber-participation rows
- 194 immutable composition runs
- 1,548 identity-adoption events
- 656 preserved ideology links
- zero broken identity/run links
- zero invalid current/retired states
- zero orphan ideology rows
- zero inferred split, merge, or succession edges
- three required history/append-only triggers installed

The migration intentionally adopts each legacy row as a provisional identity.
It does not pretend that identical names across chambers prove a shared party.
The IPU and Wikidata syncs upgrade those identities only when the publisher
supplies a stable party identifier. This is conservative identity resolution,
not a claim that all legacy party entities have already been externally
disambiguated.

## Durable verification

```text
npm run validate:party-identity
npm run validate:party-identity:live
npm run validate:research-evidence-retention:live
npm run validate:authoritative-migrations:live
RUN_DB_TESTS=1 npx tsx --test src/lib/db/__tests__/atl-011-party-honesty.test.ts
npx tsx --test src/lib/legislatures/__tests__/composition-writer.test.ts
npm run validate:design-tokens
npm run build
```

The task-specific tests cover source completeness, no fixed-source fallback,
high-confidence ideology gating, stable refresh and rename behavior, exact
legacy upgrades, soft retirement, non-inferred splits, sourced lineage, and
the absence of destructive deletes in the production writer. The complete
production build passed 1,350 tests (three documented live-DB skips) plus all
migration, claims, rights, provenance, design, golden-test, TypeScript, and
Next.js compilation gates. Desktop and 390-pixel browser checks confirmed the
source/vintage/license rows, contained table scrolling, and no console errors.

## Scope note

The country API continues to expose the established country-response contract;
ATL-011 changes the party research browser and its underlying identity/write
model. It does not claim that every country API field gained a new inline
provenance object in this task.
