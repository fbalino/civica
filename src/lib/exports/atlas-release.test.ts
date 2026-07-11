import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildAtlasExport, buildAtlasReleaseBom, serializeAtlasExport, ATLAS_EXPORT_VINTAGE_LABEL } from "./atlas-release";

const jurisdiction = { id: "j1", slug: "example", name: "Example" };
const fact = (source_id: string, id = "f1") => ({ id, canonical_fact_id: `canonical-${id}`, jurisdiction_id: "j1", fact_key: "population", source_id, value_status: "observed", fact_value_numeric: 0, vintage_label: ATLAS_EXPORT_VINTAGE_LABEL, methodology_version: "v0.2-beta", content_hash: "a".repeat(64), cut_at_timestamp: "2026-05-05T22:54:22.775Z" });

test("export ordering and serialization are deterministic", () => {
  const a = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("wikidata", "z"), fact("cia_factbook", "a")] });
  const b = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("cia_factbook", "a"), fact("wikidata", "z")] });
  assert.equal(serializeAtlasExport(a), serializeAtlasExport(b));
  assert.deepEqual(a.tables.sources.map((row) => row.sourceId), ["cia_factbook", "wikidata"]);
});

test("a pending source fails closed", () => {
  assert.throws(() => buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("vdem")] }), /blocked sources: vdem/);
});

test("a fact for a missing jurisdiction fails closed", () => {
  assert.throws(
    () => buildAtlasExport({
      jurisdictions: [jurisdiction],
      facts: [{ ...fact("wikidata"), jurisdiction_id: "missing-jurisdiction" }],
    }),
    /facts for missing jurisdictions: missing-jurisdiction/,
  );
});

test("zero remains an observed exported value", () => {
  const release = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("world_bank")] });
  assert.equal(release.tables.facts[0].fact_value_numeric, 0);
  assert.equal(release.tables.facts[0].value_status, "observed");
});

test("release BOM is deterministic and complete", () => {
  const release = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("wikidata")] });
  const serialized = serializeAtlasExport(release);
  const input = { release, serialized, compressed: new TextEncoder().encode(serialized), codeCommit: "a".repeat(40), tools: { node: "v1", next: "1", drizzleOrm: "1", typescript: "1", tsx: "1" } };
  const first = buildAtlasReleaseBom(input);
  const second = buildAtlasReleaseBom(input);
  assert.deepEqual(first, second);
  assert.equal(first.files[0].semanticSha256.length, 64);
  assert.equal(first.sourceInputs[0].rowCount, 1);
  assert.equal(first.exportSourceCommit, "a".repeat(40));
});

test("the release loader selects frozen values, source, hash, and method instead of live values", () => {
  const source = readFileSync(new URL("./atlas-release.ts", import.meta.url), "utf8");
  assert.match(source, /FROM country_fact_vintages v/);
  assert.match(source, /v\.value_text AS fact_value/);
  assert.match(source, /v\.source_id/);
  assert.match(source, /v\.content_hash/);
  assert.match(source, /v\.methodology_version/);
  assert.doesNotMatch(source, /FROM country_facts\s+WHERE status = 'active'/);
});
