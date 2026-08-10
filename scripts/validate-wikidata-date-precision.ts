import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const artifactPath = "plan/evidence/DAT-036/live-repair-plan.json";

type Artifact = {
  schemaVersion: string;
  taskId: string;
  mode: string;
  examinedRows: number;
  repairCount: number;
  requiresPublisherRefreshCount: number;
  alreadyCorrectCount: number;
  rows: Array<{
    jurisdiction: string;
    factKey: string;
    pointInTime: string;
    wikibasePrecision: number;
    repairedAsOf: string | null;
    repairedPublisherDate: {
      precision: string;
      year: number | null;
      month: number | null;
      day: number | null;
    } | null;
  }>;
  requiresPublisherRefreshRows: Array<{
    jurisdiction: string;
    factKey: string;
  }>;
  semanticSha256: string;
};

function semanticHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
const errors: string[] = [];
if (
  artifact.schemaVersion !==
  "civica-wikidata-date-precision-repair-plan/v1"
) {
  errors.push("repair-plan schema version drifted");
}
if (artifact.taskId !== "DAT-036") errors.push("task identity drifted");
if (artifact.mode !== "zero_write") {
  errors.push("checked repair plan must be zero-write evidence");
}
if (artifact.repairCount !== artifact.rows.length) {
  errors.push("repair count does not match row ledger");
}
if (artifact.examinedRows < artifact.repairCount) {
  errors.push("repair count exceeds examined rows");
}
if (
  artifact.examinedRows !==
  artifact.repairCount +
    artifact.requiresPublisherRefreshCount +
    artifact.alreadyCorrectCount
) {
  errors.push(
    "every examined row must be repairable, publisher-refresh-bound, or already correct",
  );
}
if (
  artifact.requiresPublisherRefreshCount !==
  artifact.requiresPublisherRefreshRows.length
) {
  errors.push("publisher-refresh count does not match row ledger");
}
for (const row of artifact.rows) {
  if (![9, 10, 11].includes(row.wikibasePrecision)) {
    errors.push(`${row.jurisdiction}/${row.factKey} has invalid precision`);
  }
  if (!row.repairedPublisherDate) {
    errors.push(`${row.jurisdiction}/${row.factKey} lacks publisher date`);
    continue;
  }
  if (
    row.repairedPublisherDate.precision !== "day" &&
    row.repairedAsOf !== null
  ) {
    errors.push(
      `${row.jurisdiction}/${row.factKey} still manufactures a calendar day`,
    );
  }
}
const { semanticSha256, ...withoutHash } = artifact;
if (semanticSha256 !== semanticHash(withoutHash)) {
  errors.push("repair-plan semantic hash drifted");
}

const sourceContracts: Array<[string, string[]]> = [
  [
    "src/lib/factbook/reconcile/wikidata-client.ts",
    ["wikibase:timePrecision", "pointInTimePrecision"],
  ],
  [
    "src/lib/factbook/reconcile/wikidata-sync.ts",
    ["parseWikidataPublisherDate", "valueJson"],
  ],
  [
    "src/lib/factbook/reconcile/api.ts",
    ["publisherDate: PublisherDate | null", "storedPublisherDate"],
  ],
  [
    "src/lib/exports/country-research-export.ts",
    ["publisherDate: PublisherDate | null", "publisher_date_json"],
  ],
  [
    "src/lib/exports/atlas-release.ts",
    ["value_json: row.snapshot_value_json"],
  ],
  [
    "src/components/factbook/FactValuePanel.tsx",
    ["formatPublisherDate", "publisherDate.precision"],
  ],
  [
    "src/lib/factbook/country-fact-history-writer.ts",
    ["b.value_json IS DISTINCT FROM u.value_json"],
  ],
  [
    "scripts/plan-wikidata-date-precision-repair.ts",
    ["changeKind: \"correction\"", "--correction-log-id="],
  ],
];
for (const [path, required] of sourceContracts) {
  const source = readFileSync(path, "utf8");
  for (const fragment of required) {
    if (!source.includes(fragment)) errors.push(`${path} lacks ${fragment}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(
  `PASS — DAT-036 precision contract; ${artifact.examinedRows} live Wikidata rows examined, ${artifact.repairCount} directly repairable, and ${artifact.requiresPublisherRefreshCount} require an authorized publisher refresh.`,
);
