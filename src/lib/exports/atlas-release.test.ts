import assert from "node:assert/strict";
import test from "node:test";
import { buildAtlasExport, serializeAtlasExport } from "./atlas-release";

const jurisdiction = { id: "j1", slug: "example", name: "Example" };
const fact = (source_id: string, id = "f1") => ({ id, jurisdiction_id: "j1", fact_key: "population", source_id, value_status: "observed", fact_value_numeric: 0 });

test("export ordering and serialization are deterministic", () => {
  const a = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("wikidata", "z"), fact("cia_factbook", "a")] });
  const b = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("cia_factbook", "a"), fact("wikidata", "z")] });
  assert.equal(serializeAtlasExport(a), serializeAtlasExport(b));
  assert.deepEqual(a.tables.sources.map((row) => row.sourceId), ["cia_factbook", "wikidata"]);
});

test("a pending source fails closed", () => {
  assert.throws(() => buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("vdem")] }), /blocked sources: vdem/);
});

test("zero remains an observed exported value", () => {
  const release = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("world_bank")] });
  assert.equal(release.tables.facts[0].fact_value_numeric, 0);
  assert.equal(release.tables.facts[0].value_status, "observed");
});
