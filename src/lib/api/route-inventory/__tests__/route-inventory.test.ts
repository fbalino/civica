/**
 * PLT-008 — route inventory test suite (DB-free, `npm test`).
 *
 * Two halves, mirroring `src/lib/api/contract/__tests__/contract.test.ts`:
 *
 *   1. Positive: the real `registry.ts` has an entry for all 100 real
 *      `route.ts` files under src/app, declares the same HTTP methods
 *      those files actually export, and the pure checks report zero
 *      phantom routes / zero stale entries / zero UNDOCUMENTED
 *      uncontrolled mutations against the real data (the remaining bounded
 *      pulse-coding logout revocation gap is expected and disclosed).
 *   2. Negative: seeded synthetic fixtures prove each pure check catches
 *      its failure mode — a phantom route, a stale entry, an uncontrolled
 *      cron route, and an uncontrolled admin route.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { ROUTE_INVENTORY } from "../registry";
import {
  findPhantomRoutes,
  findStaleEntries,
  findUncontrolledMutations,
  diffMethods,
} from "../checks";
import { scanExportedMethods } from "../../../../../scripts/validate-route-inventory";
import {
  isRepositoryOwned,
  loadRepositoryOwnedFiles,
} from "../../../../../scripts/repository-owned-files";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src/app");
const REPOSITORY_OWNED_FILES = loadRepositoryOwnedFiles(ROOT);

async function findRouteFilesOnDisk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findRouteFilesOnDisk(full)));
    } else if (entry.isFile() && entry.name === "route.ts") {
      found.push(full);
    }
  }
  return found;
}

async function findRepositoryRouteFilesOnDisk(): Promise<string[]> {
  const files = await findRouteFilesOnDisk(APP_DIR);
  return files.filter((file) =>
    isRepositoryOwned(path.relative(ROOT, file), REPOSITORY_OWNED_FILES),
  );
}

// ─────────────────────────────────────────────────────────────────────
// Positive: the real registry is internally consistent and complete
// ─────────────────────────────────────────────────────────────────────

test("the real registry has exactly 100 entries, one per real route.ts file", async () => {
  const diskFiles = await findRepositoryRouteFilesOnDisk();
  assert.equal(diskFiles.length, 100, "expected exactly 100 route.ts files under src/app");
  assert.equal(ROUTE_INVENTORY.length, 100);
});

test("no duplicate filePath entries in the registry", () => {
  const seen = new Set<string>();
  for (const entry of ROUTE_INVENTORY) {
    assert.ok(!seen.has(entry.filePath), `duplicate registry entry: ${entry.filePath}`);
    seen.add(entry.filePath);
  }
});

test("findPhantomRoutes and findStaleEntries are both empty against the real filesystem", async () => {
  const diskFiles = await findRepositoryRouteFilesOnDisk();
  const diskPaths = diskFiles.map((f) => path.relative(APP_DIR, f).split(path.sep).join("/"));
  const registryPaths = ROUTE_INVENTORY.map((r) => r.filePath);

  assert.deepEqual(findPhantomRoutes(diskPaths, registryPaths), []);
  assert.deepEqual(findStaleEntries(diskPaths, registryPaths), []);
});

test("the real registry has zero methods drift against a static scan of each route.ts", async () => {
  const drifts: string[] = [];
  for (const entry of ROUTE_INVENTORY) {
    const source = await fs.readFile(path.join(APP_DIR, entry.filePath), "utf8");
    const scanned = scanExportedMethods(source);
    const drift = diffMethods(entry.filePath, entry.methods, scanned);
    if (drift) {
      drifts.push(
        `${drift.filePath}: declared [${drift.declared.join(",")}] vs scanned [${drift.scanned.join(",")}]`,
      );
    }
  }
  assert.deepEqual(drifts, []);
});

test("every uncontrolled-mutation finding on the real registry is a documented, disclosed finding", () => {
  const findings = findUncontrolledMutations(ROUTE_INVENTORY);
  const undocumented = findings.filter((f) => !f.documented);
  assert.deepEqual(
    undocumented,
    [],
    `undocumented uncontrolled mutation(s) found: ${JSON.stringify(undocumented)}`,
  );
  // Owner-admin logout now has durable revocation. The participant-coding
  // logout still clears only its scoped cookie, so that bounded gap remains
  // explicitly visible until its separate credential lifecycle is revised.
  assert.deepEqual(
    findings.map((f) => f.filePath).sort(),
    ["api/pulse-coding/sign-out/route.ts"],
  );
});

test("mutation flag is true iff methods include POST/PUT/PATCH/DELETE", () => {
  for (const entry of ROUTE_INVENTORY) {
    const expectMutation = entry.methods.some((m) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(m),
    );
    assert.equal(
      entry.mutation,
      expectMutation,
      `${entry.filePath}: mutation=${entry.mutation} but methods=[${entry.methods.join(",")}]`,
    );
  }
});

test("sensitive is true for every admin/cron/chat/pulse-coding exposure entry", () => {
  for (const entry of ROUTE_INVENTORY) {
    if (["admin", "cron", "chat", "pulse-coding"].includes(entry.exposure)) {
      assert.equal(entry.sensitive, true, `${entry.filePath} should be sensitive=true`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixtures
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a live route.ts absent from the registry is a phantom route", () => {
  const diskPaths = ["api/v1/countries/route.ts", "api/v1/countries/shadow/route.ts"];
  const registryPaths = ["api/v1/countries/route.ts"];
  assert.deepEqual(findPhantomRoutes(diskPaths, registryPaths), [
    "api/v1/countries/shadow/route.ts",
  ]);
});

test("negative fixture: a registry entry with no matching file on disk is a stale entry", () => {
  const diskPaths = ["api/v1/countries/route.ts"];
  const registryPaths = ["api/v1/countries/route.ts", "api/v1/countries/deleted/route.ts"];
  assert.deepEqual(findStaleEntries(diskPaths, registryPaths), [
    "api/v1/countries/deleted/route.ts",
  ]);
});

test("negative fixture: an uncontrolled cron mutation (no cron-secret) is flagged", () => {
  const findings = findUncontrolledMutations([
    {
      filePath: "api/cron/fake/route.ts",
      exposure: "cron",
      mutation: true,
      sensitive: true,
      controls: [],
      note: "",
    },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].filePath, "api/cron/fake/route.ts");
  assert.equal(findings[0].documented, false);
});

test("negative fixture: an uncontrolled admin mutation (no session-like control) is flagged", () => {
  const findings = findUncontrolledMutations([
    {
      filePath: "api/admin/fake/route.ts",
      exposure: "admin",
      mutation: true,
      sensitive: true,
      controls: ["rate-limit"],
      note: "",
    },
  ]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /session\/credential\/oauth-bootstrap/);
});

test("negative fixture: an uncontrolled pulse-coding GET flagged sensitive is caught even without mutation", () => {
  const findings = findUncontrolledMutations([
    {
      filePath: "api/pulse-coding/fake/route.ts",
      exposure: "pulse-coding",
      mutation: false,
      sensitive: true,
      controls: ["public"],
      note: "",
    },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].documented, false);
});

test("negative fixture: an uncontrolled public-mutation route (no input-validation/rate-limit) is flagged", () => {
  const findings = findUncontrolledMutations([
    {
      // Has SOME declared control (so it isn't caught by the earlier
      // "no control at all" branch) but not one that satisfies
      // public-mutation's specific bar — proves the exposure-specific
      // rule itself, not just the blanket empty-controls case.
      filePath: "api/fake-intake/route.ts",
      exposure: "public-mutation",
      mutation: true,
      sensitive: true,
      controls: ["admin-session"],
      note: "",
    },
  ]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /input-validation or rate-limit/);
});

test("a documented finding (non-empty note) is reported but marked documented: true", () => {
  const findings = findUncontrolledMutations([
    {
      filePath: "api/admin/fake-sign-out/route.ts",
      exposure: "admin",
      mutation: true,
      sensitive: true,
      controls: [],
      note: "Intentionally open sign-out route; clearing cookies needs no prior session.",
    },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].documented, true);
});

test("a well-controlled route produces no finding", () => {
  const findings = findUncontrolledMutations([
    {
      filePath: "api/admin/fake-ok/route.ts",
      exposure: "admin",
      mutation: true,
      sensitive: true,
      controls: ["admin-session"],
      note: "",
    },
    {
      filePath: "api/cron/fake-ok/route.ts",
      exposure: "cron",
      mutation: true,
      sensitive: true,
      controls: ["cron-secret"],
      note: "",
    },
    {
      filePath: "api/fake-ok-intake/route.ts",
      exposure: "public-mutation",
      mutation: true,
      sensitive: true,
      controls: ["rate-limit"],
      note: "",
    },
    {
      filePath: "api/v1/fake-read/route.ts",
      exposure: "public-read",
      mutation: false,
      sensitive: false,
      controls: ["public"],
      note: "",
    },
  ]);
  assert.deepEqual(findings, []);
});

test("negative fixture: methods drift between declared and scanned is caught", () => {
  const source = `
    export async function GET() { return new Response("ok"); }
  `;
  const scanned = scanExportedMethods(source);
  assert.deepEqual(scanned, ["GET"]);
  const drift = diffMethods("fake/route.ts", ["GET", "POST"], scanned);
  assert.ok(drift);
  assert.deepEqual(drift!.declared, ["GET", "POST"]);
  assert.deepEqual(drift!.scanned, ["GET"]);
});

test("scanExportedMethods handles the cron shared-handler re-export pattern", () => {
  const source = `
    async function handler(request) { return new Response("ok"); }
    export { handler as GET, handler as POST };
  `;
  assert.deepEqual(scanExportedMethods(source), ["GET", "POST"]);
});
