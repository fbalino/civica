import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";

import { getDb } from "../src/lib/db";
import {
  jurisdictions,
  pulseInformationEnvironmentReleases,
  pulseInformationEnvironmentValues,
} from "../src/lib/db/schema";
import {
  buildCompleteInformationEnvironmentCoverage,
  parseOfficialInformationEnvironmentCsv,
  PULSE_INFORMATION_ENVIRONMENT_RELEASE_VERSION,
} from "../src/lib/pulse/v2/information-environment-evidence";
import { RSF_2026_CANDIDATE_RELEASE } from "../src/lib/pulse/v2/press-freedom";

config({ path: ".env.local", override: true });

const RELEASE_ID = "rsf-world-press-freedom-index-2026";
const ADOPTED_AT = new Date("2026-07-12T18:00:00.000Z");
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const inputPath = inputArg?.slice("--input=".length);
const apply = process.argv.includes("--apply");

if (!inputPath) throw new Error("Usage: --input=<official-2026.csv> [--apply]");
if (apply && process.env.PULSE_APPLY_INFORMATION_ENVIRONMENT !== "yes") {
  throw new Error("Apply requires PULSE_APPLY_INFORMATION_ENVIRONMENT=yes");
}

const bytes = readFileSync(inputPath);
const contentSha256 = createHash("sha256").update(bytes).digest("hex");
if (contentSha256 !== RSF_2026_CANDIDATE_RELEASE.contentSha256) {
  throw new Error(
    `Official input hash mismatch: expected ${RSF_2026_CANDIDATE_RELEASE.contentSha256}, got ${contentSha256}`,
  );
}
const publisherRows = parseOfficialInformationEnvironmentCsv(
  bytes.toString("utf8"),
);
if (publisherRows.length !== RSF_2026_CANDIDATE_RELEASE.publisherRows) {
  throw new Error(
    `Official input row mismatch: expected ${RSF_2026_CANDIDATE_RELEASE.publisherRows}, got ${publisherRows.length}`,
  );
}

async function main(): Promise<void> {
  const db = getDb();
  const supported = await db
    .select({ jurisdictionId: jurisdictions.id, iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(sql`${jurisdictions.type} <> 'aggregate_or_special_area'`);
  const coverage = buildCompleteInformationEnvironmentCoverage({
    supportedJurisdictions: supported,
    publisherRows,
  });
  const observed = coverage.filter(
    (row) => row.valueStatus === "observed",
  ).length;
  const missing = coverage.length - observed;

  console.log(
    JSON.stringify(
      {
        releaseId: RELEASE_ID,
        inputPath,
        contentSha256,
        publisherRows: publisherRows.length,
        supportedJurisdictions: coverage.length,
        matchedJurisdictions: observed,
        missingJurisdictions: missing,
        apply,
      },
      null,
      2,
    ),
  );

  if (!apply) process.exit(0);

  await db
    .insert(pulseInformationEnvironmentReleases)
    .values({
      releaseId: RELEASE_ID,
      schemaVersion: PULSE_INFORMATION_ENVIRONMENT_RELEASE_VERSION,
      sourceId: RSF_2026_CANDIDATE_RELEASE.sourceId,
      sourceUrl: RSF_2026_CANDIDATE_RELEASE.sourceUrl,
      methodologyUrl: RSF_2026_CANDIDATE_RELEASE.methodologyUrl,
      termsUrl: RSF_2026_CANDIDATE_RELEASE.termsUrl,
      upstreamRelease: RSF_2026_CANDIDATE_RELEASE.upstreamRelease,
      observationYear: RSF_2026_CANDIDATE_RELEASE.observationYear,
      retrievedAt: new Date(RSF_2026_CANDIDATE_RELEASE.retrievedAt),
      contentSha256,
      publisherRows: publisherRows.length,
      matchedJurisdictions: observed,
      supportedJurisdictions: coverage.length,
      redistributionPosture: RSF_2026_CANDIDATE_RELEASE.redistributionPosture,
      rightsStatus: RSF_2026_CANDIDATE_RELEASE.rightsStatus,
      useStatus: RSF_2026_CANDIDATE_RELEASE.productionUse,
      adoptedAt: ADOPTED_AT,
    })
    .onConflictDoNothing({
      target: pulseInformationEnvironmentReleases.releaseId,
    });

  await db
    .insert(pulseInformationEnvironmentValues)
    .values(
      coverage.map((row) => ({
        releaseId: RELEASE_ID,
        jurisdictionId: row.jurisdictionId,
        iso3: row.iso3,
        valueStatus: row.valueStatus,
        score: row.score,
        tier: row.tier,
        missingReason: row.missingReason,
      })),
    )
    .onConflictDoNothing();

  const [release] = await db
    .select()
    .from(pulseInformationEnvironmentReleases)
    .where(eq(pulseInformationEnvironmentReleases.releaseId, RELEASE_ID));
  const counts = await db.execute(sql`
  SELECT value_status, count(*)::int AS n
  FROM pulse_information_environment_values
  WHERE release_id = ${RELEASE_ID}
  GROUP BY value_status
`);
  console.log(
    JSON.stringify(
      { release, counts: (counts as { rows?: unknown[] }).rows ?? counts },
      null,
      2,
    ),
  );
}

void main();
