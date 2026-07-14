/**
 * QA-005 — route authorization CONTRACT test (DB-free, static source
 * check, `npm test`).
 *
 * PLT-008's `src/lib/api/route-inventory/registry.ts` declares which
 * control every admin/cron/pulse-coding route.ts CLAIMS to use
 * (admin-session, cron-secret, pulse-coding-session, credential-check,
 * oauth-bootstrap), and `findUncontrolledMutations` (checks.ts) already
 * flags a route with NO declared control. That leaves a gap: a route
 * could declare a control in the registry without ever actually calling
 * the guard function in its own source — a "declared but not wired"
 * bug the registry-only check cannot see.
 * `scripts/validate-route-inventory.ts`'s `scanControlMarkers` narrows
 * this gap for admin-session/cron-secret, but only as a non-blocking
 * WARNING, and it has no marker at all for pulse-coding-session,
 * credential-check, or oauth-bootstrap.
 *
 * This suite closes the gap for real: for every registry entry that
 * declares a guard control, it reads the ACTUAL route.ts source and
 * asserts (fails the test, not just warns) that the guard function is
 * actually CALLED — not merely imported — plus the two-route
 * credential-check login handlers and the two-route oauth-bootstrap
 * flow, which the existing scanner doesn't check at all.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ROUTE_INVENTORY,
  type RouteInventoryEntry,
} from "../route-inventory/registry";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src/app");

async function readSource(entry: RouteInventoryEntry): Promise<string> {
  return fs.readFile(path.join(APP_DIR, entry.filePath), "utf8");
}

// Guard markers require an actual invocation (open paren), not merely an
// import line, so a guard imported-but-never-called is caught.
const ADMIN_SESSION_CALL =
  /\b(?:getAdminSession|withAdminMutation|withAdminLogout)\s*\(/;
const SAME_ORIGIN_MUTATION_CALL =
  /\b(?:guardAdminMutationRequest|withAdminMutation|withAdminLogout)\s*\(/;
const ADMIN_AUDIT_CALL =
  /\b(?:withAdminMutation|withAdminLogout|recordAdminLoginAudit)\s*\(/;
// Cron routes may call the low-level bearer-token guard directly or, preferably,
// use the common execution boundary that performs that check before acquiring a
// lease. Imports and bare CRON_SECRET references deliberately do not match.
const CRON_CONTROL_CALL = /\b(?:requireCronAuth|withCronJob)\s*\(/;
const PULSE_CODING_SESSION_CALL =
  /\bgetPulseCodingSession\s*\(|\bgetPulseCodingParticipantSession\s*\(/;
const ADMIN_USERNAME_CHECK_CALL = /\bverifyAdminUsername\s*\(/;
const ADMIN_PASSWORD_CHECK_CALL = /\bverifyPassword\s*\(/;
const PULSE_CODING_ACCESS_CODE_CALL =
  /\bauthenticatePulseCodingAccessCode\s*\(/;
const OAUTH_STATE_COOKIE_MARKER = /GOOGLE_STATE_COOKIE/;
const OAUTH_ALLOWLIST_CHECK_CALL = /\bisAllowedAdminGoogleAccount\s*\(/;

const adminRoutes = ROUTE_INVENTORY.filter((e) => e.exposure === "admin");
const cronRoutes = ROUTE_INVENTORY.filter((e) => e.exposure === "cron");
const pulseCodingRoutes = ROUTE_INVENTORY.filter(
  (e) => e.exposure === "pulse-coding",
);

function handlerSlice(source: string, method: string): string {
  const direct =
    /\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  const matches = [...source.matchAll(direct)];
  const index = matches.findIndex((match) => match[1] === method);
  if (index < 0) return "";
  const start = matches[index].index ?? 0;
  const end = matches[index + 1]?.index ?? source.length;
  return source.slice(start, end);
}

// ─────────────────────────────────────────────────────────────────────
// Sanity: the filtered route classes aren't accidentally empty (would
// make every "for every entry" test below vacuously pass).
// ─────────────────────────────────────────────────────────────────────

test("admin/cron/pulse-coding route classes are non-empty (guards against a vacuous sweep)", () => {
  assert.ok(
    adminRoutes.length >= 10,
    `expected >=10 admin routes, got ${adminRoutes.length}`,
  );
  assert.ok(
    cronRoutes.length >= 30,
    `expected >=30 cron routes, got ${cronRoutes.length}`,
  );
  assert.ok(
    pulseCodingRoutes.length >= 5,
    `expected >=5 pulse-coding routes, got ${pulseCodingRoutes.length}`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// cron-secret — every cron route.ts must declare AND call the common cron
// control boundary (or the retained low-level auth guard)
// ─────────────────────────────────────────────────────────────────────

test("every cron-exposure registry entry declares the cron-secret control", () => {
  const missing = cronRoutes
    .filter((e) => !e.controls.includes("cron-secret"))
    .map((e) => e.filePath);
  assert.deepEqual(
    missing,
    [],
    `cron route(s) missing cron-secret in the registry: ${missing.join(", ")}`,
  );
});

test("every declared cron-secret route.ts source calls the sanctioned cron control boundary", async () => {
  const missing: string[] = [];
  for (const entry of cronRoutes) {
    if (!entry.controls.includes("cron-secret")) continue;
    const source = await readSource(entry);
    if (!CRON_CONTROL_CALL.test(source)) missing.push(entry.filePath);
  }
  assert.deepEqual(
    missing,
    [],
    `cron route(s) declaring cron-secret but never calling withCronJob() or requireCronAuth(): ${missing.join(", ")}`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// admin-session — every route (admin OR pulse-coding exposure) that
// declares admin-session must actually call getAdminSession()
// ─────────────────────────────────────────────────────────────────────

test("every declared admin-session route.ts source calls the direct or shared owner-session boundary", async () => {
  const missing: string[] = [];
  for (const entry of [...adminRoutes, ...pulseCodingRoutes]) {
    if (!entry.controls.includes("admin-session")) continue;
    const source = await readSource(entry);
    if (!ADMIN_SESSION_CALL.test(source)) missing.push(entry.filePath);
  }
  assert.deepEqual(
    missing,
    [],
    `route(s) declaring admin-session but never calling the owner-session boundary: ${missing.join(", ")}`,
  );
});

test("every declared same-origin mutation control is enforced inside each unsafe handler", async () => {
  const missing: string[] = [];
  for (const entry of ROUTE_INVENTORY) {
    if (!entry.controls.includes("same-origin-mutation")) continue;
    const source = await readSource(entry);
    for (const method of entry.methods.filter((value) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(value),
    )) {
      const body = handlerSlice(source, method);
      if (!SAME_ORIGIN_MUTATION_CALL.test(body)) {
        missing.push(`${entry.filePath}#${method}`);
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    `unsafe handler(s) declare same-origin-mutation without enforcing the shared guard: ${missing.join(", ")}`,
  );
});

test("every declared admin-audit control is wired inside each unsafe handler", async () => {
  const missing: string[] = [];
  for (const entry of ROUTE_INVENTORY) {
    if (!entry.controls.includes("admin-audit")) continue;
    const source = await readSource(entry);
    for (const method of entry.methods.filter((value) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(value),
    )) {
      const body = handlerSlice(source, method);
      if (!ADMIN_AUDIT_CALL.test(body)) {
        missing.push(`${entry.filePath}#${method}`);
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    `unsafe handler(s) declare admin-audit without using the common ledger: ${missing.join(", ")}`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// pulse-coding-session — every declaring route must call the session
// guard (there is no scanControlMarkers coverage for this control today)
// ─────────────────────────────────────────────────────────────────────

test("every declared pulse-coding-session route.ts source actually calls the pulse-coding session guard", async () => {
  const missing: string[] = [];
  for (const entry of pulseCodingRoutes) {
    if (!entry.controls.includes("pulse-coding-session")) continue;
    const source = await readSource(entry);
    if (!PULSE_CODING_SESSION_CALL.test(source)) missing.push(entry.filePath);
  }
  assert.deepEqual(
    missing,
    [],
    `pulse-coding route(s) declaring pulse-coding-session but never calling the guard: ${missing.join(", ")}`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// credential-check — the two login routes themselves (admin username+
// password, pulse-coding access code)
// ─────────────────────────────────────────────────────────────────────

test("the admin credential-check login route verifies both username and password", async () => {
  const entry = adminRoutes.find(
    (e) => e.filePath === "api/admin/session/route.ts",
  );
  assert.ok(entry, "expected api/admin/session/route.ts in the registry");
  assert.ok(entry!.controls.includes("credential-check"));
  const source = await readSource(entry!);
  assert.match(source, ADMIN_USERNAME_CHECK_CALL);
  assert.match(source, ADMIN_PASSWORD_CHECK_CALL);
});

test("the pulse-coding credential-check login route verifies the access code", async () => {
  const entry = pulseCodingRoutes.find(
    (e) => e.filePath === "api/pulse-coding/session/route.ts",
  );
  assert.ok(
    entry,
    "expected api/pulse-coding/session/route.ts in the registry",
  );
  assert.ok(entry!.controls.includes("credential-check"));
  const source = await readSource(entry!);
  assert.match(source, PULSE_CODING_ACCESS_CODE_CALL);
});

// ─────────────────────────────────────────────────────────────────────
// oauth-bootstrap — Google sign-in start/callback pair
// ─────────────────────────────────────────────────────────────────────

test("the oauth-bootstrap start/callback routes set and verify the CSRF state cookie, and callback gates on the account allowlist", async () => {
  const startEntry = adminRoutes.find(
    (e) => e.filePath === "api/admin/google/start/route.ts",
  );
  const callbackEntry = adminRoutes.find(
    (e) => e.filePath === "api/admin/google/callback/route.ts",
  );
  assert.ok(
    startEntry && callbackEntry,
    "expected both google/start and google/callback in the registry",
  );
  assert.ok(startEntry!.controls.includes("oauth-bootstrap"));
  assert.ok(callbackEntry!.controls.includes("oauth-bootstrap"));

  const startSource = await readSource(startEntry!);
  const callbackSource = await readSource(callbackEntry!);

  assert.match(
    startSource,
    OAUTH_STATE_COOKIE_MARKER,
    "start route must set the CSRF state cookie",
  );
  assert.match(
    callbackSource,
    OAUTH_STATE_COOKIE_MARKER,
    "callback route must read/verify the CSRF state cookie",
  );
  assert.match(
    callbackSource,
    OAUTH_ALLOWLIST_CHECK_CALL,
    "callback route must gate session issuance on the account allowlist, not just a valid Google token",
  );
});

// ─────────────────────────────────────────────────────────────────────
// Documented uncontrolled exceptions stay documented (coupling this
// file to the registry's honesty, not just its declared controls)
// ─────────────────────────────────────────────────────────────────────

test("admin logout is controlled and the narrower pulse-coding revocation gap stays explicit", () => {
  const admin = ROUTE_INVENTORY.find(
    (entry) => entry.filePath === "api/admin/sign-out/route.ts",
  );
  assert.ok(admin);
  assert.deepEqual(admin.controls, [
    "admin-session",
    "same-origin-mutation",
    "admin-audit",
  ]);

  const coding = ROUTE_INVENTORY.find(
    (entry) => entry.filePath === "api/pulse-coding/sign-out/route.ts",
  );
  assert.ok(coding);
  assert.deepEqual(coding.controls, ["same-origin-mutation"]);
  assert.match(coding.note, /OPEN FINDING \(bounded\)/);
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixtures — prove the regexes actually discriminate rather
// than trivially matching any source
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: importing an owner-session helper without calling a boundary is caught", () => {
  const source = `
    import { getAdminSession } from "@/lib/admin/session";
    export async function GET() {
      return new Response("ok");
    }
  `;
  assert.equal(ADMIN_SESSION_CALL.test(source), false);
});

test("negative fixture: a route that actually calls getAdminSession() passes the marker", () => {
  const source = `
    import { getAdminSession } from "@/lib/admin/session";
    export async function GET() {
      if (!(await getAdminSession())) return new Response("no", { status: 401 });
      return new Response("ok");
    }
  `;
  assert.equal(ADMIN_SESSION_CALL.test(source), true);
});

test("negative fixture: a POST guard cannot satisfy the DELETE handler in the same route", () => {
  const source = `
    export async function POST(request: Request) {
      const guard = guardAdminMutationRequest(request);
      if (!guard.ok) return guard.response;
      return new Response("ok");
    }
    export async function DELETE(request: Request) {
      return new Response("cleared");
    }
  `;
  assert.equal(
    SAME_ORIGIN_MUTATION_CALL.test(handlerSlice(source, "POST")),
    true,
  );
  assert.equal(
    SAME_ORIGIN_MUTATION_CALL.test(handlerSlice(source, "DELETE")),
    false,
  );
});

test("positive fixture: withCronJob() satisfies the cron control marker", () => {
  const source = `
    import { withCronJob } from "@/lib/api/cron-job";
    async function handler() {
      return new Response("ok");
    }
    const cronHandler = withCronJob("fixture.job", handler);
    export { cronHandler as GET };
  `;
  assert.equal(CRON_CONTROL_CALL.test(source), true);
});

test("negative fixture: importing withCronJob without calling it does not satisfy the cron control marker", () => {
  const source = `
    import { withCronJob } from "@/lib/api/cron-job";
    export async function GET() {
      return new Response("ok");
    }
  `;
  assert.equal(CRON_CONTROL_CALL.test(source), false);
});

test("negative fixture: a route that only checks CRON_SECRET as a bare string fails the call-based cron control marker", () => {
  // A hand-rolled CRON_SECRET comparison without the common boundary should
  // fail loudly rather than silently accept a bespoke reimplementation.
  const source = `
    export async function GET(request: Request) {
      if (request.headers.get("authorization") !== \`Bearer \${process.env.CRON_SECRET}\`) {
        return new Response("no", { status: 401 });
      }
      return new Response("ok");
    }
  `;
  assert.equal(CRON_CONTROL_CALL.test(source), false);
});

test("negative fixture: an unguarded cron handler fails the cron control marker", () => {
  const source = `
    export async function GET() {
      return new Response("ok");
    }
  `;
  assert.equal(CRON_CONTROL_CALL.test(source), false);
});
