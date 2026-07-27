import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { stableStringify } from "../src/lib/data/frozen-vintage";

const path = resolve(
  process.cwd(),
  "src/lib/elections/jurisdiction-identity.generated.json",
);
const artifact = JSON.parse(readFileSync(path, "utf8")) as {
  schemaVersion: string;
  rowCount: number;
  counts: Record<string, number>;
  rowsSha256: string;
  rows: Array<{
    rowId: string;
    jurisdictionId: string;
    basis: string;
    expectedJurisdictionId: string | null;
    observedJurisdictionIds: string[];
    observedScopeJurisdictionIds: string[];
    statusReason: string;
    status: "matched" | "missing" | "mismatch";
  }>;
};

const sha256 = (value: unknown) =>
  createHash("sha256").update(stableStringify(value)).digest("hex");
const ids = new Set(artifact.rows.map((row) => row.rowId));
const count = (status: "matched" | "missing" | "mismatch") =>
  artifact.rows.filter((row) => row.status === status).length;
const errors: string[] = [];
if (artifact.schemaVersion !== "election-jurisdiction-identity/v2")
  errors.push(`unexpected schema version ${artifact.schemaVersion}`);
if (artifact.rowCount !== 915 || artifact.rows.length !== 915)
  errors.push(`expected 915 rows, found ${artifact.rows.length}`);
if (ids.size !== artifact.rows.length) errors.push("row IDs are not unique");
if (
  artifact.rows.some(
    (row) => !row.jurisdictionId || !row.basis || !row.statusReason,
  )
)
  errors.push("a row lacks jurisdiction or evidence basis");
for (const status of ["matched", "missing", "mismatch"] as const) {
  if (artifact.counts[status] !== count(status))
    errors.push(`${status} summary does not reproduce from rows`);
}
if (artifact.rowsSha256 !== sha256(artifact.rows))
  errors.push("row hash does not reproduce");
for (const row of artifact.rows) {
  if (
    row.statusReason === "explicit_scope_mismatch" &&
    (row.basis !== "wikidata_p17_p1001" ||
      row.observedScopeJurisdictionIds.length === 0 ||
      (row.expectedJurisdictionId !== null &&
        row.observedScopeJurisdictionIds.every(
          (id) => id === row.expectedJurisdictionId,
        )))
  ) {
    errors.push(`${row.rowId} has an invalid explicit-scope mismatch`);
  }
  if (row.status === "matched" && row.statusReason.includes("mismatch"))
    errors.push(`${row.rowId} is matched with a mismatch reason`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `PASS — ${artifact.counts.matched}/${artifact.rowCount} election rows have matching publisher identity; ${artifact.counts.missing} missing and ${artifact.counts.mismatch} conflicting rows remain explicit for quarantine.`,
);
