import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { zPulseSourceCoverageReport } from "../src/lib/api/contract/schemas";
import { CURRENT_PULSE_RUNTIME_METHOD } from "../src/lib/pulse/v2/runtime-contract";
import { loadPulseSourceCoverageReport } from "../src/lib/pulse/v2/source-coverage";

function fail(message: string): never {
  throw new Error(`Pulse source-coverage validation failed: ${message}`);
}

async function main() {
  const report = zPulseSourceCoverageReport.parse(
    await loadPulseSourceCoverageReport(),
  );
  const counts = {
    operating: report.feeds.filter(({ state }) => state === "operating").length,
    degraded: report.feeds.filter(({ state }) => state === "degraded").length,
    inactive: report.feeds.filter(({ state }) => state === "inactive").length,
  };
  if (JSON.stringify(counts) !== JSON.stringify(report.summary)) {
    fail("summary does not reconcile with feed states");
  }
  const declared = new Map(
    CURRENT_PULSE_RUNTIME_METHOD.feeds.connectors.map((row) => [
      row.feedId,
      row,
    ]),
  );
  if (report.feeds.length !== declared.size)
    fail("connector registry is incomplete");
  for (const feed of report.feeds) {
    const contract = declared.get(feed.feedId);
    if (!contract) fail(`unknown feed ${feed.feedId}`);
    const canOperate =
      contract.status === "active_observed" && contract.observedInProduction;
    if (!canOperate && feed.state !== "inactive") {
      fail(`${feed.feedId} is gated/stubbed but reports ${feed.state}`);
    }
    if (feed.state === "operating") {
      if (feed.retrieval.latestOutcome !== "successful")
        fail(`${feed.feedId} operates without a successful latest retrieval`);
      if (feed.evidence.retainedRows < 1 || !feed.evidence.lastDataAt)
        fail(`${feed.feedId} operates without retained evidence`);
      if (
        feed.rights.length === 0 ||
        feed.rights.some(({ reviewStatus }) => reviewStatus === "missing")
      )
        fail(`${feed.feedId} operates without complete rights records`);
    }
    if (
      feed.retrieval.successfulRuns + feed.retrieval.failedRuns !==
      feed.retrieval.observedRuns
    ) {
      fail(`${feed.feedId} retrieval outcomes do not reconcile`);
    }
  }
  console.log(
    `PASS — ${report.summary.operating} operating, ${report.summary.degraded} degraded, ` +
      `${report.summary.inactive} inactive Pulse feeds; telemetry, evidence scope, rights, and blind spots reconcile.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
