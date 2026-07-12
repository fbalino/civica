import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MIGRATION_ARTIFACTS } from "../src/lib/db/migration-registry";

const root = process.cwd();
const report = JSON.parse(readFileSync(resolve(root, "plan/evidence/DAT-013/preflight.json"), "utf8")) as {
  appliedAuthoritativeMigrationIds?: string[];
  plans: Array<{ id: string; artifact: string; sha256: string; affectedRelations: string[]; liveRowCounts: Record<string, number | "missing">; writesPerformed: number }>;
};
const errors: string[] = [];
const byId = new Map(report.plans.map((plan) => [plan.id, plan]));
for (const entry of MIGRATION_ARTIFACTS) {
  const plan = byId.get(entry.id);
  if (!plan) { errors.push(`missing preflight: ${entry.id}`); continue; }
  const hash = createHash("sha256").update(readFileSync(resolve(root, entry.path))).digest("hex");
  if (plan.sha256 !== hash) errors.push(`${entry.id} preflight hash drift`);
  if (plan.artifact !== entry.path) errors.push(`${entry.id} artifact mismatch`);
  if (plan.writesPerformed !== 0) errors.push(`${entry.id} preflight performed writes`);
  const source = readFileSync(resolve(root, entry.path), "utf8");
  for (const relation of plan.affectedRelations) {
    const count = plan.liveRowCounts[relation];
    const createsRelation = new RegExp(
      `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+"?(?:public\\.)?${relation}"?\\b`,
      "i",
    ).test(source);
    const dropsRelation = new RegExp(
      `DROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?\\s+"?(?:public\\.)?${relation}"?\\b`,
      "i",
    ).test(source);
    const appliedDestructivePostState =
      dropsRelation && report.appliedAuthoritativeMigrationIds?.includes(entry.id);
    if (count === "missing" && !createsRelation && !appliedDestructivePostState) {
      errors.push(`${entry.id}/${relation} is unexpectedly missing before migration`);
    } else if (count !== "missing" && (!Number.isSafeInteger(count) || count < 0)) {
      errors.push(`${entry.id}/${relation} lacks a valid live row count`);
    }
  }
}
for (const plan of report.plans) if (!MIGRATION_ARTIFACTS.some((entry) => entry.id === plan.id)) errors.push(`orphan preflight: ${plan.id}`);
console.log("=== DAT-013 checked migration preflight ===\n");
console.log(`Plans: ${report.plans.length}/${MIGRATION_ARTIFACTS.length}`);
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log("\nPASS — every migration artifact has a current zero-write live row-count plan.");
