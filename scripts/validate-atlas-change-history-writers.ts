/**
 * ATL-020 production-writer guard.
 *
 * Primary Atlas entities may change only through an approved atomic boundary
 * that mutates the row and appends its bounded public history in the same
 * PostgreSQL unit. Historical repair/seed scripts remain explicit exceptions;
 * they are not recurring production adapters and must not silently grow.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOTS = ["src", "scripts"] as const;
const EXTENSIONS = new Set([".ts", ".tsx"]);

const DRIZZLE_IDENTIFIERS = [
  "countryFacts",
  "governmentBodies",
  "offices",
  "persons",
  "elections",
  "constitutionPassages",
  "organizations",
  "countryMetrics",
] as const;

const SQL_TABLES = [
  "country_facts",
  "government_bodies",
  "offices",
  "persons",
  "elections",
  "constitution_passages",
  "organizations",
  "country_metrics",
] as const;

const ATOMIC_WRITERS = new Map<string, readonly string[]>([
  [
    "src/lib/factbook/country-fact-history-writer.ts",
    ["country_facts", "atlas_entity_change_history"],
  ],
  [
    "src/lib/factbook/government-entity-history-writer.ts",
    [
      "government_bodies",
      "offices",
      "persons",
      "atlas_entity_change_history",
    ],
  ],
  [
    "src/lib/elections/writer.ts",
    ["elections", "atlas_entity_change_history"],
  ],
  [
    "src/lib/constitute/constitution-passage-history-writer.ts",
    ["constitution_passages", "atlas_entity_change_history"],
  ],
  [
    "src/lib/metrics/ingest.ts",
    ["country_metrics", "atlas_entity_change_history"],
  ],
  [
    "scripts/sync-organization-memberships.ts",
    ["organizations", "atlas_entity_change_history", ".transaction("],
  ],
]);

/** Non-recurring, historically retained repair/seed tools. */
const HISTORICAL_EXCEPTIONS = new Set([
  "scripts/backfill-cia-vintage.ts",
  "scripts/backfill-election-results.ts",
  "scripts/backfill-growth-methodology.ts",
  "scripts/backfill-methodology-version.ts",
  "scripts/backfill-upstream-vintage-labels.ts",
  "scripts/bridge-cia-legacy-to-canonical.ts",
  "scripts/cleanup-bad-offices.ts",
  "scripts/enrich-hierarchy.ts",
  "scripts/reseed-bug3-corrupted.ts",
  "scripts/restore-overdemoted-disputes.ts",
  "scripts/seed-elections.ts",
]);
const VALIDATOR_SELF = "scripts/validate-atlas-change-history-writers.ts";

function maskComments(source: string): string {
  let output = "";
  let index = 0;
  let mode: "code" | "line" | "block" | "single" | "double" | "template" =
    "code";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "code") {
      if (char === "/" && next === "/") {
        mode = "line";
        output += "  ";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        mode = "block";
        output += "  ";
        index += 2;
        continue;
      }
      if (char === "'") mode = "single";
      else if (char === '"') mode = "double";
      else if (char === "`") mode = "template";
      output += char;
      index++;
      continue;
    }
    if (mode === "line") {
      if (char === "\n") {
        mode = "code";
        output += char;
      } else {
        output += char === "\t" ? "\t" : " ";
      }
      index++;
      continue;
    }
    if (mode === "block") {
      if (char === "*" && next === "/") {
        mode = "code";
        output += "  ";
        index += 2;
        continue;
      }
      output += char === "\n" ? "\n" : char === "\t" ? "\t" : " ";
      index++;
      continue;
    }

    output += char;
    if (char === "\\") {
      output += source[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (
      (mode === "single" && char === "'") ||
      (mode === "double" && char === '"') ||
      (mode === "template" && char === "`")
    ) {
      mode = "code";
    }
    index++;
  }
  return output;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

export interface AtlasWriterViolation {
  line: number;
  detail: string;
}

export function scanAtlasPrimaryWrites(
  source: string,
): AtlasWriterViolation[] {
  const masked = maskComments(source);
  const violations: AtlasWriterViolation[] = [];
  const seen = new Set<string>();
  const record = (index: number, detail: string) => {
    const line = lineAt(source, index);
    const key = `${line}:${detail}`;
    if (!seen.has(key)) {
      seen.add(key);
      violations.push({ line, detail });
    }
  };

  const drizzle = new RegExp(
    String.raw`\.(insert|update|delete)\s*\(\s*(${DRIZZLE_IDENTIFIERS.join("|")})\s*\)`,
    "g",
  );
  for (const match of masked.matchAll(drizzle)) {
    record(
      match.index ?? 0,
      `direct Drizzle ${match[1]}(${match[2]}) bypasses an atomic history writer`,
    );
  }

  const rawSql = new RegExp(
    String.raw`\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(${SQL_TABLES.join("|")})"?\b`,
    "gi",
  );
  for (const match of masked.matchAll(rawSql)) {
    record(
      match.index ?? 0,
      `raw ${match[1].replace(/\s+/g, " ").toUpperCase()} ${match[2]} bypasses an atomic history writer`,
    );
  }
  return violations;
}

async function filesUnder(root: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      output.push(...(await filesUnder(absolute)));
    } else if (
      EXTENSIONS.has(path.extname(entry.name)) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      output.push(absolute);
    }
  }
  return output;
}

async function main() {
  const fixtureBad = [
    "await db.update(countryFacts).set({ factValue: 'x' });",
    "await sql`UPDATE elections SET election_type = 'general'`;",
  ];
  const fixtureSafe = [
    "// await db.update(countryFacts)",
    "const prose = 'Election updates require an atomic writer';",
  ];
  if (
    fixtureBad.some((fixture) => scanAtlasPrimaryWrites(fixture).length !== 1) ||
    fixtureSafe.some((fixture) => scanAtlasPrimaryWrites(fixture).length !== 0)
  ) {
    throw new Error("ATL-020 writer scanner self-test failed");
  }

  const files = (
    await Promise.all(ROOTS.map((root) => filesUnder(root)))
  ).flat();
  const failures: string[] = [];
  let scannedWrites = 0;

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    const source = await fs.readFile(file, "utf8");
    const violations = scanAtlasPrimaryWrites(source);
    if (relative === VALIDATOR_SELF) continue;
    scannedWrites += violations.length;

    if (ATOMIC_WRITERS.has(relative)) {
      for (const marker of ATOMIC_WRITERS.get(relative) ?? []) {
        if (!source.includes(marker)) {
          failures.push(`${relative}: missing atomic-writer marker ${marker}`);
        }
      }
      continue;
    }
    if (HISTORICAL_EXCEPTIONS.has(relative)) continue;
    for (const violation of violations) {
      failures.push(`${relative}:${violation.line}: ${violation.detail}`);
    }
  }

  for (const file of ATOMIC_WRITERS.keys()) {
    try {
      await fs.access(file);
    } catch {
      failures.push(`${file}: registered atomic writer is missing`);
    }
  }
  for (const file of HISTORICAL_EXCEPTIONS) {
    try {
      await fs.access(file);
    } catch {
      failures.push(`${file}: registered historical exception is missing`);
    }
  }

  console.log("=== ATL-020 primary Atlas writer validation ===\n");
  console.log(`Source files scanned: ${files.length}`);
  console.log(`Mutation sites observed: ${scannedWrites}`);
  console.log(`Atomic writer boundaries: ${ATOMIC_WRITERS.size}`);
  console.log(`Historical exceptions: ${HISTORICAL_EXCEPTIONS.size}\n`);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(
    "PASS — recurring primary-entity writes route through registered atomic history boundaries.",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
