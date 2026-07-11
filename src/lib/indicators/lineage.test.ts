import assert from "node:assert/strict";
import test from "node:test";
import { buildIndicatorLineage, indicatorIdFor, indicatorLineageErrors } from "./lineage";

test("source and dimension resolve to a first-class indicator identity", () => {
  assert.equal(indicatorIdFor("worldbank_wgi", "democratic_quality"), "va.est");
  assert.equal(indicatorIdFor("worldbank_wgi", "rule_of_law"), "rl.est");
  assert.throws(() => indicatorIdFor("unknown", "rule_of_law"), /No indicator identity/);
});

test("lineage retains substitution and exact artifact semantics", () => {
  const lineage = buildIndicatorLineage({ sourceId: "worldbank_wgi", dimension: "democratic_quality", upstreamRelease: "WGI 2025 revision", temporalCoverage: "2024", transformationId: "ci-normalize/v2", methodVersion: "beta", rows: [{ iso3: "XKX", value: 0.2 }], publisherArtifactHash: "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8", substitutionReason: "Coverage fallback where V-Dem has no row." });
  assert.equal(lineage.indicatorId, "va.est");
  assert.equal(lineage.artifactKind, "publisher_bytes");
  assert.match(lineage.substitutionReason ?? "", /V-Dem/);
  assert.deepEqual(indicatorLineageErrors(lineage), []);
});

test("a normalized batch remains an exact artifact when publisher bytes were not retained", () => {
  const lineage = buildIndicatorLineage({ sourceId: "undp_hdi", dimension: "human_development", upstreamRelease: "UNDP HDI through 2023", temporalCoverage: "1990/2023", transformationId: "source-native-history/v1", methodVersion: "history-v1", rows: [{ year: 2023, value: 0.9 }] });
  assert.equal(lineage.artifactKind, "normalized_batch");
  assert.match(lineage.artifactHash, /^[a-f0-9]{64}$/);
});
