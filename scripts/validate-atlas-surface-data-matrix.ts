import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  ATLAS_SURFACE_DATA_MATRIX,
  atlasSurfaceMatrixHash,
  renderAtlasSurfaceMatrix,
} from "../src/lib/atlas/surface-data-matrix";

assert.equal(
  readFileSync("data/atlas-surface-data-matrix.v1.json", "utf8"),
  renderAtlasSurfaceMatrix(),
);
assert.ok(
  readFileSync(
    "plan/research/atlas-surface-data-matrix-v1.md",
    "utf8",
  ).includes(atlasSurfaceMatrixHash()),
  "the human-readable matrix summary has a stale semantic hash",
);

for (const row of ATLAS_SURFACE_DATA_MATRIX.rows) {
  assert.ok(
    existsSync(row.renderer),
    `${row.id}: missing renderer ${row.renderer}`,
  );
  for (const access of row.dataAccess) {
    assert.ok(
      existsSync(access.file),
      `${row.id}: missing data file ${access.file}`,
    );
    const source = readFileSync(access.file, "utf8");
    assert.ok(
      source.includes(access.symbol),
      `${row.id}: ${access.symbol} not found in ${access.file}`,
    );
  }
  for (const path of row.tests)
    assert.ok(existsSync(path), `${row.id}: missing test ${path}`);
}

const factbookPage = readFileSync(
  "src/app/(reader)/country/[slug]/page.tsx",
  "utf8",
);
for (const row of ATLAS_SURFACE_DATA_MATRIX.rows.filter(
  ({ id }) =>
    id.startsWith("country.factbook.") &&
    id !== "country.factbook.sources-and-citation",
)) {
  const id = row.id.split(".").at(-1)!;
  assert.match(
    factbookPage,
    new RegExp(`id:\\s*["']${id}["']`),
    `${id} is no longer a rendered Factbook section`,
  );
}
const civicaPage = readFileSync(
  "src/app/(reader)/country/[slug]/civica-data/page.tsx",
  "utf8",
);
for (const row of ATLAS_SURFACE_DATA_MATRIX.rows.filter(({ id }) =>
  id.startsWith("country.civica-data."),
)) {
  const id = row.id.split(".").at(-1)!;
  assert.ok(
    civicaPage.includes(`| "${id}"`) || civicaPage.includes(`id: "${id}"`),
    `${id} is no longer a rendered Civica Data section`,
  );
}

console.log(
  `PASS — ${ATLAS_SURFACE_DATA_MATRIX.schemaVersion}: ${ATLAS_SURFACE_DATA_MATRIX.rows.length} route/module rows close data access, storage, fields, provenance, coverage, states, tests, ownership, and frozen-release relation.`,
);
