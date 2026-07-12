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
const ADMIN_SESSION_CALL = /\bgetAdminSession\s*\(/;
const CRON_AUTH_CALL = /\brequireCronAuth\s*\(/;
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

// ─────────────────────────────────────────────────────────────────────
// Sanity: the filtered route classes aren't accidentally empty (would
// make every "for every entry" test below vacuously pass).
// ─────────────────────────────────────────────────────────────────────

test("admin/cron/pulse-coding route classes are non-empty (guards against a vacuous sweep)", () => {
  assert.ok(adminRoutes.length >= 10, `expected >=10 admin routes, got ${adminRoutes.length}`);
  assert.ok(cronRoutes.length >= 30, `expected >=30 cron routes, got ${cronRoutes.length}`);
  assert.ok(
    pulseCodingRoutes.length >= 5,
    `expected >=5 pulse-coding routes, got ${pulseCodingRoutes.length}`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// cron-secret — every cron route.ts must declare AND call requireCronAuth()
// ─────────────────────────────────────────────────────────────────────

test("every cron-exposure registry entry declares the cron-secret control", () => {
  const missing = cronRoutes
    .filter((e) => !e.controls.includes("cron-secret"))
    .map((e) => e.filePath);
  assert.deepEqual(missing, [], `cron route(s) missing cron-secret in the registry: ${missing.join(", ")}`);
});

test("every declared cron-secret route.ts source actually calls requireCronAuth()", async () => {
  const missing: string[] = [];
  for (const entry of cronRoutes) {
    if (!entry.controls.includes("cron-secret")) continue;
    const source = await readSource(entry);
    if (!CRON_AUTH_CALL.test(source)) missing.push(entry.filePath);
  }
  assert.deepEqual(
    missing,
    [],
    `cron route(s) declaring cron-secret but never calling requireCronAuth(): ${missing.join(", ")}`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// admin-session — every route (admin OR pulse-coding exposure) that
// declares admin-session must actually call getAdminSession()
// ─────────────────────────────────────────────────────────────────────

test("every declared admin-session route.ts source actually calls getAdminSession()", async () => {
  const missing: string[] = [];
  for (const entry of [...adminRoutes, ...pulseCodingRoutes]) {
    if (!entry.controls.includes("admin-session")) continue;
    const source = await readSource(entry);
    if (!ADMIN_SESSION_CALL.test(source)) missing.push(entry.filePath);
  }
  assert.deepEqual(
    missing,
    [],
    `route(s) declaring admin-session but never calling getAdminSession(): ${missing.join(", ")}`,
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
  const entry = adminRoutes.find((e) => e.filePath === "api/admin/session/route.ts");
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
  assert.ok(entry, "expected api/pulse-coding/session/route.ts in the registry");
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
  assert.ok(startEntry && callbackEntry, "expected both google/start and google/callback in the registry");
  assert.ok(startEntry!.controls.includes("oauth-bootstrap"));
  assert.ok(callbackEntry!.controls.includes("oauth-bootstrap"));

  const startSource = await readSource(startEntry!);
  const callbackSource = await readSource(callbackEntry!);

  assert.match(startSource, OAUTH_STATE_COOKIE_MARKER, "start route must set the CSRF state cookie");
  assert.match(callbackSource, OAUTH_STATE_COOKIE_MARKER, "callback route must read/verify the CSRF state cookie");
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

test("documented uncontrolled sign-out routes have zero controls AND a non-empty explanatory note", () => {
  for (const filePath of [
    "api/admin/sign-out/route.ts",
    "api/pulse-coding/sign-out/route.ts",
  ]) {
    const entry = ROUTE_INVENTORY.find((e) => e.filePath === filePath);
    assert.ok(entry, `expected ${filePath} in the registry`);
    assert.equal(entry!.controls.length, 0);
    assert.ok(
      entry!.note.trim().length > 0,
      `${filePath} is documented as uncontrolled but carries no explanatory note`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixtures — prove the regexes actually discriminate rather
// than trivially matching any source
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: a route that imports getAdminSession but never calls it is caught", () => {
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

test("negative fixture: a route that only checks CRON_SECRET as a bare string (no requireCronAuth call) fails the stricter call-based marker", () => {
  // requireCronAuth is the sanctioned single path; a hand-rolled
  // CRON_SECRET comparison without going through it would not satisfy
  // this test's call-based marker, which is the intended behavior: it
  // should fail loudly rather than silently accept a bespoke reimplementation.
  const source = `
    export async function GET(request: Request) {
      if (request.headers.get("authorization") !== \`Bearer \${process.env.CRON_SECRET}\`) {
        return new Response("no", { status: 401 });
      }
      return new Response("ok");
    }
  `;
  assert.equal(CRON_AUTH_CALL.test(source), false);
});
