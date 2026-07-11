import { createHash } from "node:crypto";

export const PULSE_CLUSTER_COVERAGE_SCHEMA =
  "pulse-cluster-coverage/v1" as const;

export interface ClusterCoverageRow {
  clusterId: string;
  clusterRunVersionKey: string | null;
  algorithmVersion: string | null;
  size: number;
  sourceIds: number;
  sourceFamilies: number;
  languages: number;
  provisionalJurisdictions: number;
}

export interface ClusterCoverageDistributionRow {
  value: number;
  clusters: number;
  share: number;
}

export interface PulseClusterCoverageReport {
  schemaVersion: typeof PULSE_CLUSTER_COVERAGE_SCHEMA;
  releaseId: string;
  releasedAt: string;
  observedThrough: string | null;
  standing: "descriptive_not_validation";
  scope: string;
  totals: {
    rawReports: number;
    clusteredReports: number;
    unclusteredReports: number;
    clusters: number;
    multiReportClusters: number;
    multiSourceClusters: number;
    multiSourceFamilyClusters: number;
    multilingualClusters: number;
    mixedProvisionalJurisdictionClusters: number;
  };
  distributions: {
    clusterSize: ClusterCoverageDistributionRow[];
    sourceIdsPerCluster: ClusterCoverageDistributionRow[];
    sourceFamiliesPerCluster: ClusterCoverageDistributionRow[];
    languagesPerCluster: ClusterCoverageDistributionRow[];
    provisionalJurisdictionsPerCluster: ClusterCoverageDistributionRow[];
  };
  methodVersions: Array<{
    versionKey: string;
    algorithmVersion: string;
    clusters: number;
  }>;
  limitations: string[];
  reportHash: string;
}

function distribution(
  rows: readonly ClusterCoverageRow[],
  select: (row: ClusterCoverageRow) => number,
): ClusterCoverageDistributionRow[] {
  const counts = new Map<number, number>();
  for (const row of rows)
    counts.set(select(row), (counts.get(select(row)) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([value, clusters]) => ({
      value,
      clusters,
      share: rows.length ? Number((clusters / rows.length).toFixed(6)) : 0,
    }));
}

export function buildPulseClusterCoverageReport(input: {
  releaseId: string;
  releasedAt: string;
  observedThrough: string | null;
  rawReports: number;
  clusteredReports: number;
  rows: ClusterCoverageRow[];
}): PulseClusterCoverageReport {
  const rows = [...input.rows].sort((left, right) =>
    left.clusterId.localeCompare(right.clusterId),
  );
  const versionCounts = new Map<
    string,
    { algorithmVersion: string; clusters: number }
  >();
  for (const row of rows) {
    const key = row.clusterRunVersionKey ?? "legacy_unversioned";
    const current = versionCounts.get(key);
    versionCounts.set(key, {
      algorithmVersion: row.algorithmVersion ?? "legacy_unversioned",
      clusters: (current?.clusters ?? 0) + 1,
    });
  }
  const body = {
    schemaVersion: PULSE_CLUSTER_COVERAGE_SCHEMA,
    releaseId: input.releaseId,
    releasedAt: input.releasedAt,
    observedThrough: input.observedThrough,
    standing: "descriptive_not_validation" as const,
    scope:
      "All retained raw Pulse reports assigned to a cluster at the release cut; distributions describe stored outputs across their recorded method versions.",
    totals: {
      rawReports: input.rawReports,
      clusteredReports: input.clusteredReports,
      unclusteredReports: input.rawReports - input.clusteredReports,
      clusters: rows.length,
      multiReportClusters: rows.filter((row) => row.size > 1).length,
      multiSourceClusters: rows.filter((row) => row.sourceIds > 1).length,
      multiSourceFamilyClusters: rows.filter((row) => row.sourceFamilies > 1)
        .length,
      multilingualClusters: rows.filter((row) => row.languages > 1).length,
      mixedProvisionalJurisdictionClusters: rows.filter(
        (row) => row.provisionalJurisdictions > 1,
      ).length,
    },
    distributions: {
      clusterSize: distribution(rows, (row) => row.size),
      sourceIdsPerCluster: distribution(rows, (row) => row.sourceIds),
      sourceFamiliesPerCluster: distribution(rows, (row) => row.sourceFamilies),
      languagesPerCluster: distribution(rows, (row) => row.languages),
      provisionalJurisdictionsPerCluster: distribution(
        rows,
        (row) => row.provisionalJurisdictions,
      ),
    },
    methodVersions: [...versionCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([versionKey, value]) => ({ versionKey, ...value })),
    limitations: [
      "This is a coverage and diversity description, not evidence that clusters are correct.",
      "A distinct source-family identifier is recorded provenance, not proof of editorial independence; PUL-007 evaluates republication and common ownership.",
      "Historical and current method identities are reported separately and must not be treated as one validated series.",
      "Held-out overmerge, undermerge, and attribution accuracy belong to PUL-023.",
    ],
  };
  const reportHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  return { ...body, reportHash };
}
