import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSchemaDataDictionary,
  dictionaryValidationErrors,
  sameDictionary,
} from "./build";

test("documents every current Drizzle table and column", () => {
  const dictionary = buildSchemaDataDictionary();
  assert.equal(dictionary.summary.tables, 98);
  assert.equal(dictionary.summary.columns, 1349);
  assert.deepEqual(dictionaryValidationErrors(dictionary), []);
});

test("materializes every required metadata dimension on every column", () => {
  const dictionary = buildSchemaDataDictionary();
  for (const table of dictionary.tables) {
    for (const column of table.columns) {
      assert.ok(column.definition);
      assert.ok(column.sqlType);
      assert.ok(column.unit);
      assert.ok(column.nullableMeaning);
      assert.equal(typeof column.key.primary, "boolean");
      assert.equal(typeof column.key.unique, "boolean");
      assert.equal(typeof column.key.indexed, "boolean");
      assert.ok(Array.isArray(column.key.indexGroups));
      assert.ok(Array.isArray(column.key.uniqueGroups));
      assert.ok(column.sourceOrDerivation);
      assert.ok(column.cadence);
      assert.ok(column.vintageSemantics);
      assert.ok(column.rights);
      assert.ok(column.deprecation.status);
    }
  }
});

test("does not misstate a member of a composite unique index as individually unique", () => {
  const dictionary = buildSchemaDataDictionary();
  const sourceId = dictionary.tables
    .find((table) => table.name === "country_facts")
    ?.columns.find((column) => column.name === "source_id");
  assert.equal(sourceId?.key.unique, false);
  assert.deepEqual(sourceId?.key.uniqueGroups, [
    "idx_country_facts_jurisdiction_factkey_source",
  ]);
});

test("marks legacy Pulse tables and jurisdiction cache columns explicitly", () => {
  const dictionary = buildSchemaDataDictionary();
  assert.equal(
    dictionary.tables.find((table) => table.name === "pulse_events")
      ?.deprecation.status,
    "legacy",
  );
  const jurisdictions = dictionary.tables.find(
    (table) => table.name === "jurisdictions",
  );
  assert.equal(
    jurisdictions?.columns.find((column) => column.name === "population")
      ?.deprecation.status,
    "legacy",
  );
  assert.equal(
    jurisdictions?.columns.find((column) => column.name === "name")?.deprecation
      .status,
    "active",
  );
});

test("distinguishes source time, observation time, and method version in field metadata", () => {
  const dictionary = buildSchemaDataDictionary();
  const facts = dictionary.tables.find(
    (table) => table.name === "country_facts",
  );
  assert.match(
    facts?.columns.find((column) => column.name === "retrieved_at")
      ?.vintageSemantics ?? "",
    /retrieval\/processing time/i,
  );
  assert.match(
    facts?.columns.find((column) => column.name === "data_vintage_year")
      ?.vintageSemantics ?? "",
    /measurement/i,
  );
  assert.match(
    facts?.columns.find((column) => column.name === "methodology_version")
      ?.vintageSemantics ?? "",
    /Interpretation\/version/i,
  );
});

test("detects a seeded checked-artifact drift", () => {
  const current = buildSchemaDataDictionary();
  const drifted = structuredClone(current);
  drifted.tables[0].columns[0].definition = "seeded schema/dictionary drift";
  assert.equal(sameDictionary(current, drifted), false);
  assert.equal(sameDictionary(current, structuredClone(current)), true);
});
