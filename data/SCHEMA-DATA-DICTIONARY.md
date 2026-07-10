# Civica schema data dictionary

The machine-readable dictionary is
[`schema-data-dictionary.v1.json`](schema-data-dictionary.v1.json). It covers
the full Drizzle schema, including public Atlas data, research-Beta tables,
public support records, internal operations, and private submissions. Private
and internal tables are documented so they cannot be mistaken for release
data.

Each table records its row grain, release scope, origin or derivation, update
cadence, vintage rules, rights posture, and deprecation state. Each column
materializes those fields alongside its SQL type, unit, null meaning, default,
primary/unique/index/foreign-key structure, and column-specific retirement
state.

The dictionary distinguishes four kinds of time where the schema permits it:
the date an event or observation describes, the publisher's dataset release or
vintage, Civica's retrieval/processing time, and the Civica method or release
version. A SQL `null` still collapses several absence states in parts of the
current schema. The dictionary states that limitation on every nullable field;
DAT-015 owns the database and API changes needed to separate those states.

## Updating the dictionary

After changing `src/lib/db/schema.ts` or the table policies in
`src/lib/data-dictionary/registry.ts`, run:

```bash
npm run generate:data-dictionary
npm run validate:data-dictionary
```

The production build runs the validator. It recomputes the schema fingerprint
and the complete artifact, so adding, removing, renaming, or changing a column
fails until the checked dictionary is regenerated and reviewed.
