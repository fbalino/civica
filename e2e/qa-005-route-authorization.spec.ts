/**
 * QA-005 — runtime route-authorization proof against the REAL running app
 * (`npm run test:e2e -- qa-005-route-authorization`, reuses the QA-009
 * harness/BASE_URL; never spawns a second dev server).
 *
 * The other two QA-005 files (`src/lib/api/__tests__/route-authorization.test.ts`,
 * `.../api-contract-shape.test.ts`) are static/DB-free — they prove the
 * registry declares the right guard AND that the guard is actually called
 * in source. This file is the runtime complement: it sends REAL,
 * UNAUTHENTICATED HTTP requests at representative admin/cron/pulse-coding/
 * public-mutation/chat endpoints and asserts they reject — proving the
 * guard doesn't just exist in source but actually fires at request time.
 *
 * Every request here is read-only in effect: auth checks run BEFORE body
 * parsing or any DB write on every route exercised (verified against
 * source before writing these assertions), so an unauthenticated
 * POST/PATCH never reaches a mutation. No admin/cron credentials are used
 * anywhere in this file — that is the point. `/api/chat` is exercised only
 * with inputs its own abuse-control validation rejects BEFORE calling the
 * Anthropic client (empty message, oversized message), so no paid model
 * call ever happens.
 *
 * This spec deliberately lives under e2e/, not src/**\/*.test.ts — it
 * requires a live server and must never run inside `npm test` /
 * `npm run validate:claims-docs` (which the "test" npmScript in
 * `src/lib/ci/claims-docs-gate.ts` runs in CI with no server listening).
 * `test:e2e` is not wired into any GitHub workflow today, so this file
 * only runs when a human/agent explicitly invokes it against a live app.
 */
import { test, expect } from "./harness/fixtures";

test.describe("QA-005 — public route sanity (positive control)", () => {
  test("a real public /api/v1 route succeeds, proving the harness itself is reachable", async ({
    request,
  }) => {
    // DAT-031: country reads require an explicit as_of selection; this is
    // a param-validation contract, not an auth gate, and confirms the
    // baseline "server is up and public reads work" before we assert that
    // OTHER routes reject.
    const res = await request.get("/api/v1/countries?as_of=live&limit=1");
    expect(res.status()).toBe(200);
  });

  test("the same public route without as_of fails closed on a validation contract, not a 500", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/countries");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/as_of/);
  });
});

test.describe("QA-005 — admin-session routes reject unauthenticated requests", () => {
  test("GET /api/admin/contact without a session cookie returns 401 with no submission data", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/contact");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized." });
    // No data leak: the unauthorized envelope must not carry the
    // `submissions` array the authenticated 200 response returns.
    expect(body.submissions).toBeUndefined();
  });

  test("POST /api/admin/messages/:id without a session cookie returns 401 before touching the row", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/admin/messages/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/admin/data-disputes/:id without a session cookie or body returns 401, not a body-shape error", async ({
    request,
  }) => {
    // No body at all is sent — if the auth check ran AFTER body parsing
    // this would surface as a 400 (missing `action`); getting 401 proves
    // getAdminSession() gates before any request-body handling.
    const res = await request.post(
      "/api/admin/data-disputes/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/pulse-coding/admin/participants (admin-session-gated pulse-coding route) without a cookie returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/pulse-coding/admin/participants");
    expect(res.status()).toBe(401);
  });
});

test.describe("QA-005 — cron-secret routes reject unauthenticated/incorrect bearers", () => {
  test("GET /api/cron/pulse/v2/ingest with no Authorization header returns 401", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/pulse/v2/ingest");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("GET /api/cron/pulse/v2/ingest with a wrong bearer token returns 401 (not 200)", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/pulse/v2/ingest", {
      headers: { Authorization: "Bearer definitely-not-the-real-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/cron/factbook/sync-wikidata with no bearer returns 401 (second cron route, different family)", async ({
    request,
  }) => {
    const res = await request.get("/api/cron/factbook/sync-wikidata");
    expect(res.status()).toBe(401);
  });
});

test.describe("QA-005 — pulse-coding-session routes reject unauthenticated requests", () => {
  test("POST /api/pulse-coding/assignments/:id without a session cookie returns 401", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/pulse-coding/assignments/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/pulse-coding/adjudications/:assignmentId without a session cookie returns 401", async ({
    request,
  }) => {
    const res = await request.post(
      "/api/pulse-coding/adjudications/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status()).toBe(401);
  });
});

test.describe("QA-005 — public-mutation intake routes reject malformed bodies before any write", () => {
  test("POST /api/contact with malformed JSON returns 400 (or a genuine 429), never 500 or a silent write", async ({
    request,
  }) => {
    // Send raw, deliberately-unparseable bytes as a Buffer — a plain
    // string `data` value with an explicit application/json header gets
    // JSON.stringify'd by Playwright's request fixture (turning invalid
    // JSON into a syntactically-valid JSON *string literal*), which would
    // reach the handler as valid-but-wrong-shape JSON instead of exercising
    // its `JSON.parse` failure branch.
    //
    // /api/contact enforces a tight per-IP budget (5 requests / 10 min)
    // and checks it BEFORE parsing the body, so repeated local runs of
    // this spec (or manual probing from the same IP) can legitimately
    // exhaust it first — that is correct rate-limit behavior, not a test
    // bug. Accept either outcome, but require each to prove itself: a 400
    // must carry the "Invalid JSON" message, a 429 must carry Retry-After
    // (proving it's the real rate limiter, not some other rejection).
    const res = await request.post("/api/contact", {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{not-valid-json", "utf8"),
    });
    expect([400, 429]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toMatch(/Invalid JSON/i);
    } else {
      expect(res.headers()["retry-after"]).toBeTruthy();
    }
    expect(res.status()).not.toBe(500);
  });

  test("POST /api/civica-index/corrections with malformed JSON returns 4xx, not 500", async ({
    request,
  }) => {
    const res = await request.post("/api/civica-index/corrections", {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("not-json-at-all", "utf8"),
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/advisory-applications with an empty body is rejected as a validation error, not accepted", async ({
    request,
  }) => {
    const res = await request.post("/api/advisory-applications", {
      headers: { "Content-Type": "application/json" },
      data: "{}",
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("QA-005 — /api/chat abuse-control validation rejects before any model call", () => {
  test("an empty message is rejected 400 before the Anthropic client is invoked", async ({
    request,
  }) => {
    const res = await request.post("/api/chat", {
      headers: { "Content-Type": "application/json" },
      data: { message: "" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty message/i);
  });

  test("a malformed JSON body is rejected 400 before the Anthropic client is invoked", async ({
    request,
  }) => {
    const res = await request.post("/api/chat", {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{not-json", "utf8"),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/malformed json/i);
  });

  test("an oversized message is rejected 413 before the Anthropic client is invoked (no paid call)", async ({
    request,
  }) => {
    const res = await request.post("/api/chat", {
      headers: { "Content-Type": "application/json" },
      data: { message: "x".repeat(5000) }, // over the 4000-char MAX_MESSAGE_LEN
    });
    expect(res.status()).toBe(413);
  });
});
