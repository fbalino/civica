import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ATLAS_SURFACE_DATA_MATRIX,
  ATLAS_SURFACE_STATE_KEYS,
  renderAtlasSurfaceMatrix,
} from "./surface-data-matrix";

test("every row has a closed owner, release, state, evidence, and test posture", () => {
  const ids = new Set<string>();
  for (const row of ATLAS_SURFACE_DATA_MATRIX.rows) {
    assert.ok(!ids.has(row.id), row.id);
    ids.add(row.id);
    assert.ok(row.owner.trim(), row.id);
    assert.ok(row.releaseReason.trim(), row.id);
    assert.ok(row.renderer.trim(), row.id);
    assert.ok(row.dataAccess.length > 0, row.id);
    assert.ok(row.storage.length > 0, row.id);
    assert.ok(row.fields.length > 0, row.id);
    assert.ok(row.provenance.length > 0, row.id);
    assert.ok(row.coverage.length > 0, row.id);
    for (const key of ATLAS_SURFACE_STATE_KEYS) {
      assert.ok(row.states[key].trim(), `${row.id}:${key}`);
    }
    assert.notEqual(row.tests.length === 0, row.testGap === null, row.id);
  }
});

test("every declared country module and core data route is registered", () => {
  const ids = new Set(ATLAS_SURFACE_DATA_MATRIX.rows.map(({ id }) => id));
  for (const id of [
    "route.home",
    "route.atlas",
    "route.country-index",
    "route.parties",
    "route.compare",
    "route.elections",
    "route.conditions",
    "route.governance-evidence",
    "route.rankings",
    "route.constitution-explorer",
    "route.organization-detail",
    "route.reconciliation-disputes",
    "route.provenance-coverage",
    "route.source-coverage",
    "country.shared.masthead",
    "country.factbook.sources-and-citation",
    "country.constitution.reader",
  ])
    assert.ok(ids.has(id), id);
  for (const id of [
    "overview",
    "geography",
    "people",
    "government",
    "economy",
    "energy",
    "communications",
    "transport",
    "environment",
    "military",
    "terrorism",
    "space",
    "transnational",
  ])
    assert.ok(ids.has(`country.factbook.${id}`), id);
  for (const id of [
    "evidence-coverage",
    "governance-evidence",
    "longitudinal",
    "government",
    "legislature",
    "leaders",
    "bills",
    "organizations",
    "rankings",
  ])
    assert.ok(ids.has(`country.civica-data.${id}`), id);
});

test("the checked matrix is the deterministic canonical artifact", () => {
  assert.equal(
    readFileSync("data/atlas-surface-data-matrix.v1.json", "utf8"),
    renderAtlasSurfaceMatrix(),
  );
});
