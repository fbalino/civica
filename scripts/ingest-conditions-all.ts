/** Civica Conditions — one immutable three-dimension release. */

import { readFile, writeFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { runCombinedConditionsIngestion } from "../src/lib/conditions/production-workflow";
import {
  conditionsReleaseExpectationTargetsMatch,
  conditionsReleaseExpectationsArtifactSha256,
  createConditionsReleaseExpectationsArtifact,
  parseConditionsReleaseExpectationsArtifact,
  serializeConditionsReleaseExpectationsArtifact,
} from "../src/lib/conditions/release-expectations";
import type { ConditionsReleaseValidationExpectations } from "../src/lib/conditions/release-live-validation";
import {
  inspectNeonTarget,
  neonTargetExpectationsFromArguments,
} from "../src/lib/qa/neon-target";

function argument(prefix: string): string | undefined {
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

const DRY_RUN = process.argv.includes("--dry-run");
const RELEASE_ID = argument("--release-id=");
const INPUT_FILE = argument("--economic-input=");
const CAPTURE_OUTPUT = argument("--economic-capture-output=");
const EXPECTATIONS_OUTPUT = argument("--expectations-output=");
const EXPECTATIONS_INPUT = argument("--expectations-input=");
const EXPECTED_EXPECTATIONS_SHA256 = argument(
  "--expected-expectations-sha256=",
);

async function main() {
  if (!RELEASE_ID) {
    throw new Error("Pass a stable --release-id=conditions-*-vN; releases are never implicit");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const target = await inspectNeonTarget({
    databaseUrl,
    sql: neon(databaseUrl),
    expectations: neonTargetExpectationsFromArguments(process.argv),
  });
  let releaseExpectations: ConditionsReleaseValidationExpectations | undefined;
  let expectationsArtifactSha256: string | null = null;
  if (DRY_RUN) {
    if (
      !EXPECTATIONS_OUTPUT ||
      EXPECTATIONS_INPUT ||
      EXPECTED_EXPECTATIONS_SHA256
    ) {
      throw new Error(
        "Dry run requires only --expectations-output=<new-file>",
      );
    }
  } else {
    if (
      !EXPECTATIONS_INPUT ||
      !/^[a-f0-9]{64}$/.test(EXPECTED_EXPECTATIONS_SHA256 ?? "") ||
      EXPECTATIONS_OUTPUT
    ) {
      throw new Error(
        "Apply requires --expectations-input=<file> and --expected-expectations-sha256=<sha256>",
      );
    }
    const serializedExpectations = await readFile(EXPECTATIONS_INPUT, "utf8");
    expectationsArtifactSha256 =
      conditionsReleaseExpectationsArtifactSha256(serializedExpectations);
    if (expectationsArtifactSha256 !== EXPECTED_EXPECTATIONS_SHA256) {
      throw new Error("Conditions expectations artifact hash does not match");
    }
    const artifact = parseConditionsReleaseExpectationsArtifact(
      serializedExpectations,
    );
    if (
      artifact.releaseId !== RELEASE_ID ||
      !conditionsReleaseExpectationTargetsMatch(
        artifact.databaseTarget,
        target,
      )
    ) {
      throw new Error(
        "Conditions expectations artifact does not match the release or database target",
      );
    }
    releaseExpectations = {
      releaseManifestSha256: artifact.releaseManifestSha256,
      expectedCalculationCounts: artifact.expectedCalculationCounts,
    };
  }
  const result = await runCombinedConditionsIngestion(db, {
    releaseId: RELEASE_ID,
    dryRun: DRY_RUN,
    inputFile: INPUT_FILE,
    captureOutput: CAPTURE_OUTPUT,
    releaseExpectations,
  });
  if (DRY_RUN) {
    const artifact = createConditionsReleaseExpectationsArtifact({
      releaseId: result.release.releaseId,
      releaseManifestSha256: result.releaseManifestSha256,
      expectedCalculationCounts: result.expectedCalculationCounts,
      databaseTarget: target,
    });
    const serializedArtifact =
      serializeConditionsReleaseExpectationsArtifact(artifact);
    expectationsArtifactSha256 =
      conditionsReleaseExpectationsArtifactSha256(serializedArtifact);
    await writeFile(EXPECTATIONS_OUTPUT!, serializedArtifact, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        ...artifact,
        expectationsArtifactSha256,
      }),
    );
    return;
  }
  const dimensions = new Set(result.rows.map((row) => row.dimension));
  console.log(
    `Done: ${result.summary.proposed} calculations, ${result.summary.written} scores, and ${result.summary.componentsWritten} component rows.`,
  );
  console.log(
    `Release: ${RELEASE_ID} | Dimensions: ${[...dimensions].sort().join(", ")}`,
  );
  console.log(`Database target: ${JSON.stringify(target)}`);
  console.log(`Expectations artifact SHA-256: ${expectationsArtifactSha256}`);
}

main().catch(() => {
  console.error("Conditions ingestion failed closed");
  process.exit(1);
});
