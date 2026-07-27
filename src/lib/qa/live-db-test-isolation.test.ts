/**
 * QA-004 — static proof that no test can modify production.
 *
 * The ONLY sanctioned live-DB path is `getLiveReadOnlyDb()` (which refuses
 * mutation at runtime). This scanner is the second layer: it fails if any test
 * file imports the production Drizzle client (`db`/`getDb`/`createDb` from a
 * production db module) AND issues a write method (`insert`/`update`/`delete`/
 * `execute`) on it. Pure function + seeded fixtures under `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Production modules that export a live read/write Drizzle client. */
const PRODUCTION_DB_IMPORTS = [
  "@/lib/db",
  "@/lib/ci/ingest",
  "@/lib/pulse/v2/ingest",
];

const WRITE_METHOD = /\b(?:db|getDb\(\)|createDb\(\))\.(insert|update|delete|execute)\(/;

export interface DbWriteViolation {
  path: string;
  method: string;
  line: number;
}

/** Return violations: files importing a production db client AND writing on it. */
export function findProductionDbWrites(
  files: Array<{ path: string; source: string }>,
): DbWriteViolation[] {
  const violations: DbWriteViolation[] = [];
  for (const { path, source } of files) {
    const importsProductionDb = PRODUCTION_DB_IMPORTS.some((mod) => {
      // e.g. import { db } from "@/lib/db"  /  import { getDb } from "@/lib/db"
      const re = new RegExp(
        `import[^;]*\\b(db|getDb|createDb)\\b[^;]*from\\s*["']${mod.replace(
          /[/\-]/g,
          (c) => "\\" + c,
        )}["']`,
      );
      return re.test(source);
    });
    if (!importsProductionDb) continue;
    const lines = source.split("\n");
    lines.forEach((text, i) => {
      const m = WRITE_METHOD.exec(text);
      if (m) violations.push({ path, method: m[1], line: i + 1 });
    });
  }
  return violations;
}

function walkTestFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTestFiles(full));
    else if (entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

// This scanner's own file embeds intentional fixture strings that look like a
// production write; exclude it from the real-repo scan (its detection is proven
// by the seeded-fixtures test below instead).
const SELF = "live-db-test-isolation.test.ts";

test("no test file writes to the production database", () => {
  const files = [...walkTestFiles("src"), ...walkTestFiles("scripts")]
    .filter((path) => !path.endsWith(SELF))
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
  assert.ok(files.length > 100, "expected to scan the real test suite");
  const violations = findProductionDbWrites(files);
  assert.deepEqual(
    violations,
    [],
    `tests must not write to the production db:\n${violations
      .map((v) => `  ${v.path}:${v.line} db.${v.method}()`)
      .join("\n")}`,
  );
});

test("the scanner flags a seeded production write and ignores safe patterns", () => {
  const seeded = [
    {
      path: "fixture/writes.test.ts",
      source:
        'import { db } from "@/lib/db";\ntest("x", async () => { await db.insert(sources).values({}); });',
    },
    {
      path: "fixture/reads.test.ts",
      source:
        'import { db } from "@/lib/db";\ntest("x", async () => { await db.select().from(sources); });',
    },
    {
      path: "fixture/fixture-db.test.ts",
      // A disposable fixture cluster (its own pg client) is NOT the production db.
      source:
        'import { drizzle } from "drizzle-orm/node-postgres";\nconst local = drizzle(pool);\nawait local.insert(sources).values({});',
    },
    {
      path: "fixture/readonly.test.ts",
      source:
        'import { getLiveReadOnlyDb } from "@/lib/db/live-readonly";\nconst ro = getLiveReadOnlyDb();\nawait ro.select().from(sources);',
    },
  ];
  const violations = findProductionDbWrites(seeded);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].path, "fixture/writes.test.ts");
  assert.equal(violations[0].method, "insert");
});
