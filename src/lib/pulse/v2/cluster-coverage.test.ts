import assert from "node:assert/strict";
import test from "node:test";
import { buildPulseClusterCoverageReport } from "./cluster-coverage";

test("cluster coverage reconciles distributions and separates method versions", () => {
  const report = buildPulseClusterCoverageReport({
    releaseId: "fixture-release",
    releasedAt: "2026-07-11T00:00:00.000Z",
    observedThrough: "2026-07-10T00:00:00.000Z",
    rawReports: 4,
    clusteredReports: 3,
    rows: [
      {
        clusterId: "cluster-a",
        clusterRunVersionKey: "legacy-key",
        algorithmVersion: null,
        size: 1,
        sourceIds: 1,
        sourceFamilies: 1,
        languages: 1,
        provisionalJurisdictions: 1,
      },
      {
        clusterId: "cluster-b",
        clusterRunVersionKey: "current-key",
        algorithmVersion: "pulse-cluster/normalized-global-union-find-v3",
        size: 2,
        sourceIds: 2,
        sourceFamilies: 2,
        languages: 2,
        provisionalJurisdictions: 0,
      },
    ],
  });
  assert.equal(report.standing, "descriptive_not_validation");
  assert.deepEqual(report.totals, {
    rawReports: 4,
    clusteredReports: 3,
    unclusteredReports: 1,
    clusters: 2,
    multiReportClusters: 1,
    multiSourceClusters: 1,
    multiSourceFamilyClusters: 1,
    multilingualClusters: 1,
    mixedProvisionalJurisdictionClusters: 0,
  });
  assert.deepEqual(
    report.methodVersions.map(({ algorithmVersion, clusters }) => ({
      algorithmVersion,
      clusters,
    })),
    [
      {
        algorithmVersion: "pulse-cluster/normalized-global-union-find-v3",
        clusters: 1,
      },
      { algorithmVersion: "legacy_unversioned", clusters: 1 },
    ],
  );
  assert.equal(report.reportHash.length, 64);
});
