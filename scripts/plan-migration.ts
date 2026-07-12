import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { MIGRATION_ARTIFACTS } from "../src/lib/db/migration-registry";
import { buildMigrationPlan } from "../src/lib/db/migration-planner";

config({ path: ".env.local" });

async function main() {
  const args = new Map(process.argv.slice(2).map((arg) => { const [key, ...rest] = arg.replace(/^--/, "").split("="); return [key, rest.join("=") || "true"]; }));
  const id = args.get("id");
  if (!id && !args.has("all")) throw new Error("Usage: npm run db:plan -- --id=<migration-id>|--all [--live] [--out=<path>]");
  const entries = args.has("all") ? [...MIGRATION_ARTIFACTS] : MIGRATION_ARTIFACTS.filter((item) => item.id === id);
  if (entries.length === 0) throw new Error(`Unknown migration id: ${id}`);
  const countCache = new Map<string, number | "missing">();
  const sql = args.has("live") ? (() => { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live row counts"); return neon(process.env.DATABASE_URL); })() : null;
  let appliedAuthoritativeMigrationIds: string[] = [];
  if (sql) {
    const [ledger] = await sql`SELECT to_regclass('civica_meta.schema_migrations')::text AS name`;
    if (ledger?.name) {
      const rows = await sql`SELECT id FROM civica_meta.schema_migrations ORDER BY id`;
      appliedAuthoritativeMigrationIds = rows.map((row) => String(row.id));
    }
  }
  const reports = [];
  for (const entry of entries) {
    const source = readFileSync(resolve(process.cwd(), entry.path), "utf8");
    const plan = buildMigrationPlan(entry, source);
    const rowCounts: Record<string, number | "missing"> = {};
  if (args.has("live")) {
    for (const relation of plan.affectedRelations) {
      if (!/^[a-z][a-z0-9_]*$/.test(relation)) throw new Error(`Unsafe relation name: ${relation}`);
      if (!countCache.has(relation)) {
        const exists = await sql!`SELECT to_regclass(${`public.${relation}`})::text AS name`;
        if (!exists[0]?.name) countCache.set(relation, "missing");
        else { const count = await sql!.query(`SELECT COUNT(*)::int AS n FROM "${relation}"`, []); countCache.set(relation, Number((count as unknown as Array<{ n: number }>)[0]?.n ?? 0)); }
      }
      rowCounts[relation] = countCache.get(relation)!;
    }
  }
    reports.push({ ...plan, liveRowCounts: args.has("live") ? rowCounts : "not_requested", writesPerformed: 0 });
  }
  const payload = args.has("all")
    ? {
        generatedAt: new Date().toISOString(),
        appliedAuthoritativeMigrationIds,
        plans: reports,
      }
    : reports[0];
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const output = args.get("out");
  if (output && output !== "true") { writeFileSync(resolve(process.cwd(), output), serialized); console.log(`Wrote ${reports.length} zero-write migration plan(s) to ${output}.`); }
  else process.stdout.write(serialized);
}
main().catch((error) => { console.error(error); process.exit(1); });
