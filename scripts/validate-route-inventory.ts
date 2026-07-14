/**
 * validate-route-inventory — PLT-008 route security/exposure inventory
 * validator.
 *
 *   Run with:  npm run validate:route-inventory
 *              npm run validate:route-inventory -- --help
 *
 * Deterministic, DB-free, network-free. Does a REAL `find src/app -name
 * route.ts` walk and a REAL static scan of every route.ts source for
 * exported HTTP method handlers and control markers, then runs the pure
 * comparison functions in `src/lib/api/route-inventory/checks.ts` against
 * `src/lib/api/route-inventory/registry.ts`:
 *
 *   1. Phantom routes — a route.ts on disk with no registry entry. FAIL.
 *   2. Stale entries — a registry entry whose filePath is not on disk. FAIL.
 *   3. Method drift — a registry entry's declared `methods` differ from
 *      the methods actually exported by its route.ts source. FAIL.
 *   4. Uncontrolled mutations/sensitive routes — a mutation-or-sensitive
 *      entry whose declared `controls` don't clear its exposure class's
 *      minimum bar (see checks.ts). PLT-008's Done-when only requires
 *      that these be FLAGGED, not that none may exist — so a finding
 *      whose registry entry carries a non-empty `note` explaining it is
 *      printed as a WARNING (the inventory is honest about it) and does
 *      NOT fail the build. A finding with no `note` — an undisclosed gap —
 *      FAILS, because that is indistinguishable from an oversight.
 *
 * Every check's comparison logic is a pure function taking plain
 * strings/arrays — see `src/lib/api/route-inventory/__tests__/route-inventory.test.ts`
 * for synthetic-fixture coverage of every failure mode.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { ROUTE_INVENTORY, type HttpMethod } from "../src/lib/api/route-inventory/registry";
import {
  findPhantomRoutes,
  findStaleEntries,
  findUncontrolledMutations,
  diffMethods,
} from "../src/lib/api/route-inventory/checks";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src/app");

interface Report {
  errors: string[];
  warnings: string[];
  info: string[];
}

function parseArgs(argv: string[]): { help: boolean } {
  return { help: argv.includes("--help") || argv.includes("-h") };
}

/** Recursively finds every `route.ts` under `src/app`, mirroring
 *  `find src/app -name route.ts`. */
async function findRouteFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findRouteFiles(full)));
    } else if (entry.isFile() && entry.name === "route.ts") {
      found.push(full);
    }
  }
  return found;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS);

/** Statically scans a route.ts source for exported HTTP method handlers.
 *  Handles both direct declarations (`export async function GET(...)`)
 *  and the shared-handler re-export pattern every cron route uses
 *  (`export { handler as GET, handler as POST };`). */
export function scanExportedMethods(source: string): HttpMethod[] {
  const found = new Set<string>();

  const directRe = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  let m: RegExpExecArray | null;
  while ((m = directRe.exec(source))) found.add(m[1]);

  const reExportBlockRe = /export\s*\{([^}]*)\}/g;
  while ((m = reExportBlockRe.exec(source))) {
    const asRe = /\bas\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
    let asMatch: RegExpExecArray | null;
    while ((asMatch = asRe.exec(m[1]))) found.add(asMatch[1]);
  }

  return [...found].filter((m2): m2 is HttpMethod => HTTP_METHOD_SET.has(m2)).sort() as HttpMethod[];
}

export interface ScannedControls {
  adminSession: boolean;
  cronAuth: boolean;
  rateLimit: boolean;
  inputValidationMarker: boolean;
}

/** Statically scans a route.ts source for the four control-marker
 *  families PLT-008 asks for: admin session import, cron control call,
 *  rate-limit import, and zod/.parse(/input-validation markers. This is
 *  informational cross-check output (printed, not gating) — the pure
 *  `findUncontrolledMutations` check operates on the registry's
 *  hand-curated, reviewed `controls` field, not on this raw scan, since a
 *  bare `.parse(` (e.g. `JSON.parse`) is not reliably "real" validation. */
export function scanControlMarkers(source: string): ScannedControls {
  return {
    adminSession:
      /getAdminSession|requireAdminSession|withAdminMutation|withAdminLogout|admin\/session/.test(source),
    cronAuth: /\b(?:requireCronAuth|withCronJob)\s*\(/.test(source),
    rateLimit: /RateLimit|rate-limit|rate_limit/.test(source),
    inputValidationMarker: /\bz\.|from ["']zod["']|\.parse\(|\.safeParse\(/.test(source),
  };
}

async function readFile(absPath: string): Promise<string> {
  return fs.readFile(absPath, "utf8");
}

function toAppRelative(absPath: string): string {
  return path.relative(APP_DIR, absPath).split(path.sep).join("/");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      [
        "validate-route-inventory — PLT-008 route inventory validator",
        "",
        "Usage:",
        "  npm run validate:route-inventory",
        "",
        "Walks src/app for every route.ts, statically scans exported HTTP",
        "methods and control markers, and cross-checks against",
        "src/lib/api/route-inventory/registry.ts. Fails on phantom routes,",
        "stale entries, method drift, or an undocumented uncontrolled",
        "mutation/sensitive route.",
      ].join("\n"),
    );
    process.exit(0);
  }

  console.log("=== Civica route inventory validation (PLT-008) ===\n");

  const report: Report = { errors: [], warnings: [], info: [] };

  const diskFiles = await findRouteFiles(APP_DIR);
  const diskPaths = diskFiles.map(toAppRelative).sort();
  const registryPaths = ROUTE_INVENTORY.map((r) => r.filePath).sort();

  report.info.push(
    `${diskPaths.length} route.ts file(s) on disk under src/app, ${ROUTE_INVENTORY.length} registry entr(y/ies)`,
  );

  // 0. Duplicate registry entries (a registry bug, not a disk/registry
  // drift, but it would silently hide a phantom/stale finding).
  const seen = new Set<string>();
  for (const entry of ROUTE_INVENTORY) {
    if (seen.has(entry.filePath)) {
      report.errors.push(`[registry] duplicate registry entry: ${entry.filePath}`);
    }
    seen.add(entry.filePath);
  }

  // 1. Phantom routes
  const phantoms = findPhantomRoutes(diskPaths, registryPaths);
  for (const p of phantoms) {
    report.errors.push(
      `[inventory] phantom route: ${p} exists on disk under src/app but has no route-inventory/registry.ts entry`,
    );
  }
  report.info.push(`[inventory] ${phantoms.length} phantom route(s)`);

  // 2. Stale entries
  const stale = findStaleEntries(diskPaths, registryPaths);
  for (const p of stale) {
    report.errors.push(
      `[inventory] stale entry: route-inventory/registry.ts names ${p}, which does not exist on disk`,
    );
  }
  report.info.push(`[inventory] ${stale.length} stale entr(y/ies)`);

  // 3. Method drift + control-marker cross-check (informational)
  let driftCount = 0;
  for (const entry of ROUTE_INVENTORY) {
    const absPath = path.join(ROOT, "src/app", entry.filePath);
    let source: string;
    try {
      source = await readFile(absPath);
    } catch {
      // Already reported as a stale entry above; skip further scanning.
      continue;
    }

    const scannedMethods = scanExportedMethods(source);
    const drift = diffMethods(entry.filePath, entry.methods, scannedMethods);
    if (drift) {
      driftCount += 1;
      report.errors.push(
        `[method-drift] ${entry.filePath}: registry declares [${drift.declared.join(", ")}] but source exports [${drift.scanned.join(", ")}]`,
      );
    }

    const markers = scanControlMarkers(source);
    const registryClaimsAdmin = entry.controls.includes("admin-session");
    const registryClaimsCron = entry.controls.includes("cron-secret");
    if (registryClaimsAdmin && !markers.adminSession) {
      report.warnings.push(
        `[control-scan] ${entry.filePath}: registry declares admin-session but no direct/shared owner-session marker was found in source`,
      );
    }
    if (registryClaimsCron && !markers.cronAuth) {
      report.warnings.push(
        `[control-scan] ${entry.filePath}: registry declares cron-secret but no withCronJob()/requireCronAuth() control call was found in source`,
      );
    }
  }
  report.info.push(`[method-drift] ${driftCount} route(s) with methods drift`);

  // 4. Uncontrolled mutations / sensitive routes
  const uncontrolled = findUncontrolledMutations(ROUTE_INVENTORY);
  const undocumented = uncontrolled.filter((f) => !f.documented);
  const documented = uncontrolled.filter((f) => f.documented);

  for (const f of documented) {
    report.warnings.push(
      `[uncontrolled] (documented, non-blocking) ${f.filePath} [${f.exposure}] — ${f.reason}`,
    );
  }
  for (const f of undocumented) {
    report.errors.push(
      `[uncontrolled] (UNDOCUMENTED — blocking) ${f.filePath} [${f.exposure}] — ${f.reason}; add an explanatory \`note\` to the registry entry if this is intentional, or add a real control if not`,
    );
  }
  report.info.push(
    `[uncontrolled] ${uncontrolled.length} mutable/sensitive route(s) flagged (${documented.length} documented/non-blocking, ${undocumented.length} undocumented/blocking)`,
  );

  // Exposure-class breakdown
  const byExposure = new Map<string, number>();
  for (const entry of ROUTE_INVENTORY) {
    byExposure.set(entry.exposure, (byExposure.get(entry.exposure) ?? 0) + 1);
  }
  report.info.push(
    `[breakdown] ${[...byExposure.entries()].sort().map(([k, v]) => `${k}=${v}`).join(", ")}`,
  );

  for (const line of report.info) console.log(`✓ ${line}`);
  console.log("");

  if (report.warnings.length > 0) {
    console.log(`${report.warnings.length} warning(s) (non-blocking):\n`);
    for (const line of report.warnings) console.log(`⚠ ${line}`);
    console.log("");
  }

  if (report.errors.length > 0) {
    console.error(`${report.errors.length} error(s):\n`);
    for (const line of report.errors) console.error(`✗ ${line}`);
    process.exit(1);
  }

  console.log("All route-inventory checks passed.");
}

const isMainModule =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
