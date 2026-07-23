import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ATLAS_QUERY_EXCLUSIONS,
  atlasQueryCompatibilityError,
  atlasQueryCsv,
  parseAtlasQueryArtifact,
  runAtlasQuery,
} from "./atlas-query";
import { zAtlasQueryResponse } from "@/lib/api/contract/schemas";

const artifact = readFileSync(
  "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
);
const manifest = readFileSync(
  "data/releases/atlas-2026-07-11/manifest.v1.json",
  "utf8",
);
const loaded = parseAtlasQueryArtifact(artifact, manifest);

test("the checked frozen release passes hashes, schema, counts, columns, and rights", () => {
  assert.equal(loaded.release.releaseId, "atlas-2026-07-11");
  assert.equal(loaded.release.schemaVersion, "civica-atlas-export/v3");
  assert.equal(loaded.release.tables.jurisdictions.length, 253);
  assert.equal(loaded.release.tables.facts.length, 12_373);
  assert.equal(loaded.release.tables.sources.length, 3);
  assert.match(loaded.semanticSha256, /^[a-f0-9]{64}$/);
});

test("fact queries filter by jurisdiction and key, project fields, and attach rights", () => {
  const result = runAtlasQuery(loaded, {
    table: "facts",
    fields: [
      "jurisdiction_id",
      "fact_key",
      "fact_value_numeric",
      "source_id",
      "vintage_label",
    ],
    jurisdiction: ["FRA"],
    factKey: ["population"],
    limit: 10,
    offset: 0,
  });

  assert.equal(result.schemaVersion, "civica-atlas-query/v1");
  assert.equal(result.release.id, "atlas-2026-07-11");
  assert.ok(result.data.length > 0);
  assert.ok(result.data.every((row) => row.fact_key === "population"));
  assert.deepEqual(Object.keys(result.data[0]), result.query.fields);
  assert.deepEqual(
    result.rights.sources.map((source) => source.sourceId),
    [...new Set(result.data.map((row) => row.source_id))],
  );
  assert.doesNotThrow(() => zAtlasQueryResponse.parse(result));
  assert.equal(result.exclusions, ATLAS_QUERY_EXCLUSIONS);
});

test("stable ordering is applied before pagination and JSON/CSV rows agree", () => {
  const first = runAtlasQuery(loaded, {
    table: "jurisdictions",
    fields: ["slug", "name", "iso3"],
    status: ["sovereign_state"],
    limit: 2,
    offset: 0,
  });
  const second = runAtlasQuery(loaded, {
    table: "jurisdictions",
    fields: ["slug", "name", "iso3"],
    status: ["sovereign_state"],
    limit: 2,
    offset: first.meta.nextOffset!,
  });

  assert.equal(first.meta.nextOffset, 2);
  assert.equal(second.meta.previousOffset, 0);
  assert.notDeepEqual(first.data, second.data);
  assert.equal(
    atlasQueryCsv(first).split("\n")[0],
    "slug,name,iso3",
  );
  assert.equal(atlasQueryCsv(first).split("\n").length, first.data.length + 2);
});

test("CSV output neutralizes spreadsheet formulas without changing numeric negatives", () => {
  const base = runAtlasQuery(loaded, {
    table: "jurisdictions",
    fields: ["slug", "name"],
    limit: 1,
    offset: 0,
  });
  const result = {
    ...base,
    data: [{ slug: "=HYPERLINK(\"https://attacker.test\")", name: -12.5 }],
  };
  assert.equal(
    atlasQueryCsv(result),
    "slug,name\n\"'=HYPERLINK(\"\"https://attacker.test\"\")\",-12.5\n",
  );
});

test("empty result preserves schema, rights, exclusions, and bounded pagination", () => {
  const result = runAtlasQuery(loaded, {
    table: "facts",
    jurisdiction: ["not-a-real-jurisdiction"],
    limit: 25,
    offset: 0,
  });
  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
  assert.equal(result.meta.hasMore, false);
  assert.equal(result.meta.nextOffset, null);
  assert.equal(Object.keys(result.schema.columns).length, result.query.fields.length);
  assert.deepEqual(result.rights.sources, []);
  assert.match(result.rights.note, /source-rights row/);
  assert.equal(result.exclusions.length, 6);
});

test("unknown fields, reversed years, and table-incompatible filters fail before querying", () => {
  assert.match(
    atlasQueryCompatibilityError({
      table: "facts",
      fields: ["fact_key", "raw_payload"],
      limit: 10,
      offset: 0,
    })!,
    /Unknown facts field/,
  );
  assert.match(
    atlasQueryCompatibilityError({
      table: "facts",
      yearFrom: 2025,
      yearTo: 2024,
      limit: 10,
      offset: 0,
    })!,
    /year_from/,
  );
  assert.match(
    atlasQueryCompatibilityError({
      table: "sources",
      jurisdiction: ["france"],
      limit: 10,
      offset: 0,
    })!,
    /not available for sources/,
  );
});

test("tampered compressed and semantic artifacts fail closed", () => {
  const damaged = Buffer.from(artifact);
  damaged[damaged.length - 1] ^= 1;
  assert.throws(
    () => parseAtlasQueryArtifact(damaged, manifest),
    /compressed artifact hash mismatch/,
  );

  const parsedManifest = JSON.parse(manifest);
  parsedManifest.files[0].semanticSha256 = "0".repeat(64);
  assert.throws(
    () =>
      parseAtlasQueryArtifact(
        artifact,
        `${JSON.stringify(parsedManifest)}\n`,
      ),
    /semantic artifact hash mismatch/,
  );
});
