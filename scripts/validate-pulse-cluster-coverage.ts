import { createHash } from "node:crypto";
import report from "../src/lib/pulse/v2/cluster-coverage.generated.json";
import { PULSE_CLUSTER_COVERAGE_SCHEMA } from "../src/lib/pulse/v2/cluster-coverage";

const errors: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) errors.push(message);
};
const body = { ...report } as Record<string, unknown>;
delete body.reportHash;
check(
  report.schemaVersion === PULSE_CLUSTER_COVERAGE_SCHEMA,
  "schema version drift",
);
check(
  /^pulse-cluster-coverage-\d{8}T\d{6}Z$/.test(report.releaseId),
  "release id is not timestamp-unique",
);
check(
  Number.isFinite(Date.parse(report.releasedAt)),
  "release timestamp is invalid",
);
check(
  report.standing === "descriptive_not_validation",
  "report must not claim validation",
);
check(
  report.totals.rawReports ===
    report.totals.clusteredReports + report.totals.unclusteredReports,
  "raw-report totals do not reconcile",
);
for (const [name, rows] of Object.entries(report.distributions)) {
  check(
    rows.reduce((sum, row) => sum + row.clusters, 0) === report.totals.clusters,
    `${name} does not cover every cluster`,
  );
}
check(
  report.methodVersions.reduce((sum, row) => sum + row.clusters, 0) ===
    report.totals.clusters,
  "method versions do not cover every cluster",
);
check(
  report.methodVersions.every((row) => row.algorithmVersion.length > 0),
  "method version lacks an algorithm identity",
);
check(
  createHash("sha256").update(JSON.stringify(body)).digest("hex") ===
    report.reportHash,
  "report hash mismatch",
);
if (errors.length)
  throw new Error(`Pulse cluster coverage invalid:\n- ${errors.join("\n- ")}`);
console.log(
  `Pulse cluster coverage valid (${report.totals.clusters} clusters, ${report.reportHash}).`,
);
