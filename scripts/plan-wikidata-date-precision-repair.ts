import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import {
  upsertCountryFactWithHistory,
  type CountryFactInsert,
} from "../src/lib/factbook/country-fact-history-writer";
import {
  parseWikidataPublisherDate,
  storedPublisherDate,
} from "../src/lib/factbook/reconcile/publisher-date";

const outputPath = "plan/evidence/DAT-036/live-repair-plan.json";
const write = process.argv.includes("--write");
const apply = process.argv.includes("--apply");
const releaseId =
  process.argv.find((arg) => arg.startsWith("--release-id="))?.split("=")[1] ??
  "";
const correctionLogId =
  process.argv
    .find((arg) => arg.startsWith("--correction-log-id="))
    ?.split("=")[1] ?? "";

type LiveRow = {
  id: string;
  jurisdictionId: string;
  slug: string;
  factKey: string;
  factGroup: string;
  category: string;
  sourceId: "wikidata";
  sourceUrl: string | null;
  wikidataQid: string | null;
  wikidataPid: string | null;
  wikidataRank: string | null;
  references: unknown;
  sourceHash: string | null;
  factValue: string | null;
  factValueNumeric: number | null;
  factUnit: string | null;
  factYear: number | null;
  valueJson: unknown;
  valueStatus: string;
  valueStatusReason: string | null;
  asOf: string | null;
  dataVintageYear: number | null;
  retrievedAt: string | Date;
  upstreamVintageLabel: string | null;
  methodologyVersion: string;
  status: string;
  statusReason: string | null;
  snapshotId: string | null;
  sourceNote: string | null;
  valueType: string;
  growthMethodology: string | null;
  pointInTime: string | null;
  pointInTimePrecision: number | null;
};

function rowsFrom(result: unknown): LiveRow[] {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: LiveRow[] }).rows ?? [])) as LiveRow[];
}

function inferredPrecision(pointInTime: string | null): number | undefined {
  if (!pointInTime) return undefined;
  const match = pointInTime.replace(/^\+/, "").match(
    /^\d{4}-(\d{2})-(\d{2})/,
  );
  if (!match) return undefined;
  if (match[1] === "00") return 9;
  if (match[2] === "00") return 10;
  // Legacy SPARQL snapshots normalize lower-precision Wikibase values to
  // valid-looking calendar dates. A date such as 2022-01-01 therefore cannot
  // be treated as day precision unless the explicit Wikibase precision was
  // retained. The repaired sync must re-query the publisher.
  return undefined;
}

function semanticHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

async function loadLiveRows() {
  return rowsFrom(
    await db.execute(sql`
      SELECT
        cf.id,
        cf.jurisdiction_id AS "jurisdictionId",
        j.slug,
        cf.fact_key AS "factKey",
        cf.fact_group AS "factGroup",
        cf.category,
        cf.source_id AS "sourceId",
        cf.source_url AS "sourceUrl",
        cf.wikidata_qid AS "wikidataQid",
        cf.wikidata_pid AS "wikidataPid",
        cf.wikidata_rank AS "wikidataRank",
        cf.references,
        cf.source_hash AS "sourceHash",
        cf.fact_value AS "factValue",
        cf.fact_value_numeric AS "factValueNumeric",
        cf.fact_unit AS "factUnit",
        cf.fact_year AS "factYear",
        cf.value_json AS "valueJson",
        cf.value_status AS "valueStatus",
        cf.value_status_reason AS "valueStatusReason",
        cf.as_of::text AS "asOf",
        cf.data_vintage_year AS "dataVintageYear",
        cf.retrieved_at AS "retrievedAt",
        cf.upstream_vintage_label AS "upstreamVintageLabel",
        cf.methodology_version AS "methodologyVersion",
        cf.status,
        cf.status_reason AS "statusReason",
        cf.snapshot_id AS "snapshotId",
        cf.source_note AS "sourceNote",
        cf.value_type AS "valueType",
        cf.growth_methodology AS "growthMethodology",
        fs.payload ->> 'pointInTime' AS "pointInTime",
        CASE
          WHEN (fs.payload ->> 'pointInTimePrecision') ~ '^[0-9]+$'
          THEN (fs.payload ->> 'pointInTimePrecision')::integer
          ELSE NULL
        END AS "pointInTimePrecision"
      FROM country_facts cf
      JOIN jurisdictions j ON j.id = cf.jurisdiction_id
      LEFT JOIN fact_snapshots fs ON fs.id = cf.snapshot_id
      WHERE cf.source_id = 'wikidata'
        AND fs.payload ->> 'pointInTime' IS NOT NULL
      ORDER BY j.slug, cf.fact_key
    `),
  );
}

function repairFor(row: LiveRow) {
  const precision =
    row.pointInTimePrecision ?? inferredPrecision(row.pointInTime);
  if (precision === undefined) {
    return {
      row,
      precision,
      expected: null,
      stored: storedPublisherDate(row.valueJson),
      needsRepair: false,
      requiresPublisherRefresh: true,
    };
  }
  const expected = parseWikidataPublisherDate(
    row.pointInTime ?? undefined,
    precision,
  );
  const stored = storedPublisherDate(row.valueJson);
  const expectedPublisherDate = expected.valueJson?.publisherDate ?? null;
  const needsRepair =
    row.asOf !== expected.asOf ||
    JSON.stringify(stored) !== JSON.stringify(expectedPublisherDate);
  return {
    row,
    precision,
    expected,
    stored,
    needsRepair,
    requiresPublisherRefresh: false,
  };
}

async function applyRepair(
  repair: ReturnType<typeof repairFor>,
) {
  const { row, expected } = repair;
  if (!expected) {
    throw new Error("Cannot repair a row without retained publisher precision");
  }
  const existingObject =
    row.valueJson && typeof row.valueJson === "object"
      ? (row.valueJson as Record<string, unknown>)
      : {};
  const values: CountryFactInsert = {
    id: row.id,
    jurisdictionId: row.jurisdictionId,
    factKey: row.factKey,
    factGroup: row.factGroup,
    category: row.category,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    wikidataQid: row.wikidataQid,
    wikidataPid: row.wikidataPid,
    wikidataRank: row.wikidataRank,
    references: row.references,
    sourceHash: row.sourceHash,
    factValue: row.factValue,
    factValueNumeric: row.factValueNumeric,
    factUnit: row.factUnit,
    factYear: expected.factYear,
    valueJson: {
      ...existingObject,
      publisherDate: expected.valueJson!.publisherDate,
    },
    valueStatus: row.valueStatus,
    valueStatusReason: row.valueStatusReason,
    asOf: expected.asOf,
    dataVintageYear: row.dataVintageYear,
    retrievedAt:
      row.retrievedAt instanceof Date
        ? row.retrievedAt
        : new Date(row.retrievedAt),
    upstreamVintageLabel: row.upstreamVintageLabel,
    methodologyVersion: row.methodologyVersion,
    status: row.status,
    statusReason: row.statusReason,
    snapshotId: row.snapshotId,
    sourceNote: row.sourceNote,
    valueType: row.valueType,
    growthMethodology: row.growthMethodology,
  };
  await upsertCountryFactWithHistory(db, {
    values,
    history: {
      changeKind: "correction",
      reason:
        "DAT-036: replace manufactured calendar-day precision with the retained Wikidata publisher precision",
      methodologyVersion: row.methodologyVersion,
      releaseId,
      correctionLogId,
      correctionStatus: "resolved_corrected",
    },
  });
}

async function main() {
  if (apply) {
    if (!/^[A-Za-z0-9._-]{1,96}$/.test(releaseId)) {
      throw new Error("--apply requires --release-id=<authorized-release>");
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        correctionLogId,
      )
    ) {
      throw new Error(
        "--apply requires --correction-log-id=<retained-correction-uuid>",
      );
    }
  }

  const liveRows = await loadLiveRows();
  const assessments = liveRows.map(repairFor);
  const repairs = assessments.filter(
    (row): row is ReturnType<typeof repairFor> & { expected: NonNullable<ReturnType<typeof repairFor>["expected"]> } =>
      row.needsRepair && row.expected !== null,
  );
  const unresolved = assessments.filter(
    (row) => row.requiresPublisherRefresh,
  );
  // Post-repair rows whose retained snapshot precision already matches the
  // stored representation: healthy, neither repairable nor refresh-bound.
  const alreadyCorrect = assessments.filter(
    (row) => !row.needsRepair && !row.requiresPublisherRefresh,
  );
  if (apply) {
    for (const repair of repairs) await applyRepair(repair);
  }

  const withoutHash = {
    schemaVersion: "civica-wikidata-date-precision-repair-plan/v1",
    taskId: "DAT-036",
    generatedAt: new Date().toISOString(),
    mode: apply ? "authorized_apply" : "zero_write",
    examinedRows: liveRows.length,
    repairCount: repairs.length,
    requiresPublisherRefreshCount: unresolved.length,
    alreadyCorrectCount: alreadyCorrect.length,
    limitation:
      "Legacy SPARQL snapshots did not retain Wikibase time precision; valid-looking January 1 dates cannot be classified without a fresh publisher query. The corrected sync captures precision before any authorized write.",
    rows: repairs.map(({ row, precision, expected, stored }) => ({
      factId: row.id,
      jurisdiction: row.slug,
      factKey: row.factKey,
      pointInTime: row.pointInTime,
      wikibasePrecision: precision ?? null,
      storedAsOf: row.asOf,
      storedPublisherDate: stored,
      repairedAsOf: expected.asOf,
      repairedPublisherDate: expected.valueJson?.publisherDate ?? null,
      snapshotId: row.snapshotId,
    })),
    requiresPublisherRefreshRows: unresolved.map(({ row }) => ({
      factId: row.id,
      jurisdiction: row.slug,
      factKey: row.factKey,
      legacyPointInTime: row.pointInTime,
      snapshotId: row.snapshotId,
    })),
  };
  const artifact = {
    ...withoutHash,
    semanticSha256: semanticHash(withoutHash),
  };
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  if (write) writeFileSync(outputPath, serialized);
  else process.stdout.write(serialized);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
