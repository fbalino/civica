import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import {
  buildPulseClusterCoverageReport,
  type ClusterCoverageRow,
} from "../src/lib/pulse/v2/cluster-coverage";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const [totals] = await sql`
    SELECT COUNT(*)::int AS "rawReports",
      COUNT(cluster_id)::int AS "clusteredReports",
      MAX(retrieved_at)::text AS "observedThrough"
    FROM raw_events
  `;
  const rows = await sql`
    SELECT r.cluster_id::text AS "clusterId",
      p.version_key AS "clusterRunVersionKey",
      COALESCE(p.versions->'algorithm'->>'id', p.versions->'algorithm'->>'state') AS "algorithmVersion",
      COUNT(*)::int AS size,
      COUNT(DISTINCT r.source_id)::int AS "sourceIds",
      COUNT(DISTINCT r.evidence_publisher->>'sourceFamilyId')::int AS "sourceFamilies",
      COUNT(DISTINCT r.evidence_language)::int AS languages,
      COUNT(DISTINCT r.jurisdiction_id)::int AS "provisionalJurisdictions"
    FROM raw_events r
    LEFT JOIN pulse_pipeline_runs p ON p.id = r.cluster_run_id
    WHERE r.cluster_id IS NOT NULL
    GROUP BY r.cluster_id, p.version_key,
      p.versions->'algorithm'->>'id', p.versions->'algorithm'->>'state'
    ORDER BY r.cluster_id
  `;
  const releaseDate = new Date().toISOString();
  const releaseStamp = releaseDate
    .replace(/\.\d{3}Z$/, "Z")
    .replaceAll("-", "")
    .replaceAll(":", "");
  const report = buildPulseClusterCoverageReport({
    releaseId: `pulse-cluster-coverage-${releaseStamp}`,
    releasedAt: releaseDate,
    observedThrough: totals.observedThrough,
    rawReports: totals.rawReports,
    clusteredReports: totals.clusteredReports,
    rows: rows as ClusterCoverageRow[],
  });
  const output = resolve(
    process.cwd(),
    "src/lib/pulse/v2/cluster-coverage.generated.json",
  );
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${output}`);
  console.log(JSON.stringify(report.totals));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
