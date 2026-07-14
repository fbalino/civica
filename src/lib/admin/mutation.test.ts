import assert from "node:assert/strict";
import { test } from "node:test";

import { ADMIN_SESSION_VERSION, type AdminSession } from "./session";
import { runAdminMutation, type AdminMutationDependencies } from "./mutation";
import { recordAdminLoginAudit, type AdminAuditEvent } from "./mutation-audit";

const session: AdminSession = {
  version: ADMIN_SESSION_VERSION,
  reviewerId: "Fernando Balino",
  issuedAt: 1_752_499_200,
  expiresAt: 1_753_104_000,
  sessionId: "b".repeat(36),
};
const descriptor = {
  route: "/api/admin/messages/[id]",
  action: "contact_submission.update",
  targetType: "contact_submission",
  targetId: "00000000-0000-4000-8000-000000000001",
};

function request(site = "same-origin"): Request {
  return new Request("https://civicaatlas.org/api/admin/messages/1", {
    method: "POST",
    headers: { "Sec-Fetch-Site": site },
  });
}

function fixture(
  options: {
    session?: AdminSession | null;
    sessionError?: Error;
    auditErrorAt?: number;
  } = {},
) {
  const audits: AdminAuditEvent[] = [];
  const logErrors: string[] = [];
  let auditCalls = 0;
  const dependencies: AdminMutationDependencies = {
    async getSession() {
      if (options.sessionError) throw options.sessionError;
      return options.session === undefined ? session : options.session;
    },
    async writeAudit(event) {
      auditCalls += 1;
      if (options.auditErrorAt === auditCalls) throw new Error("audit offline");
      audits.push(event);
    },
    requestId: () => "00000000-0000-4000-8000-000000000001",
    logError(message) {
      logErrors.push(message);
    },
  };
  return { audits, dependencies, logErrors };
}

test("one shared boundary records actor/action/target and a successful result", async () => {
  const state = fixture();
  let called = 0;
  const response = await runAdminMutation(
    request(),
    descriptor,
    async (actor) => {
      called += 1;
      assert.equal(actor.reviewerId, "Fernando Balino");
      return Response.json({ ok: true });
    },
    state.dependencies,
  );
  assert.equal(response.status, 200);
  assert.equal(called, 1);
  assert.deepEqual(
    state.audits.map(({ event, result, httpStatus }) => ({
      event,
      result,
      httpStatus,
    })),
    [
      { event: "attempt", result: "attempted", httpStatus: null },
      { event: "outcome", result: "succeeded", httpStatus: 200 },
    ],
  );
  assert.equal(state.audits[1].actorId, "Fernando Balino");
  assert.equal(state.audits[1].action, descriptor.action);
  assert.equal(state.audits[1].targetId, descriptor.targetId);
  assert.match(state.audits[1].sessionKey, /^[a-f0-9]{64}$/);
});

test("validation responses are retained as rejected outcomes", async () => {
  const state = fixture();
  const response = await runAdminMutation(
    request(),
    descriptor,
    async () => Response.json({ error: "invalid" }, { status: 400 }),
    state.dependencies,
  );
  assert.equal(response.status, 400);
  assert.equal(state.audits[1].result, "rejected");
  assert.equal(state.audits[1].reasonCode, "http_400");
});

test("cross-site requests never call the handler and retain a generic denial", async () => {
  const state = fixture();
  let called = false;
  const response = await runAdminMutation(
    request("cross-site"),
    descriptor,
    async () => {
      called = true;
      return new Response(null, { status: 204 });
    },
    state.dependencies,
  );
  assert.equal(response.status, 403);
  assert.equal(called, false);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].result, "rejected");
  assert.deepEqual(await response.json(), { error: "Forbidden" });
});

test("authorization ignores bearer headers and fails closed on store errors", async () => {
  const absent = fixture({ session: null });
  const bearer = new Request("https://civicaatlas.org/api/admin/messages/1", {
    method: "POST",
    headers: {
      Authorization: "Bearer supposedly-secret",
      "Sec-Fetch-Site": "same-origin",
    },
  });
  assert.equal(
    (
      await runAdminMutation(
        bearer,
        descriptor,
        async () => new Response(null, { status: 204 }),
        absent.dependencies,
      )
    ).status,
    401,
  );
  assert.deepEqual(absent.audits, []);

  const outage = fixture({ sessionError: new Error("revocations offline") });
  assert.equal(
    (
      await runAdminMutation(
        request(),
        descriptor,
        async () => new Response(null, { status: 204 }),
        outage.dependencies,
      )
    ).status,
    503,
  );
});

test("attempt audit is a fail-closed prerequisite to business work", async () => {
  const state = fixture({ auditErrorAt: 1 });
  let called = false;
  const response = await runAdminMutation(
    request(),
    descriptor,
    async () => {
      called = true;
      return new Response(null, { status: 204 });
    },
    state.dependencies,
  );
  assert.equal(response.status, 503);
  assert.equal(called, false);
});

test("thrown handlers produce a sanitized failed audit outcome", async () => {
  const state = fixture();
  const response = await runAdminMutation(
    request(),
    descriptor,
    async () => {
      throw new Error("sensitive database detail");
    },
    state.dependencies,
  );
  assert.equal(response.status, 500);
  assert.equal(
    JSON.stringify(await response.json()).includes("sensitive"),
    false,
  );
  assert.equal(state.audits.at(-1)?.result, "failed");
  assert.equal(state.audits.at(-1)?.reasonCode, "handler_exception");
});

test("a terminal-audit outage leaves a durable attempted result without falsifying the completed response", async () => {
  const state = fixture({ auditErrorAt: 2 });
  const response = await runAdminMutation(
    request(),
    descriptor,
    async () => new Response(null, { status: 204 }),
    state.dependencies,
  );

  assert.equal(response.status, 204);
  assert.deepEqual(
    state.audits.map(({ event, result }) => ({ event, result })),
    [{ event: "attempt", result: "attempted" }],
  );
  assert.deepEqual(state.logErrors, ["[admin-mutation] outcome audit failed"]);
});

test("password and Google cookie issuance write bounded successful login outcomes", async () => {
  const events: AdminAuditEvent[] = [];
  for (const [actorSource, route] of [
    ["password_login", "/api/admin/session"],
    ["google_login", "/api/admin/google/callback"],
  ] as const) {
    await recordAdminLoginAudit(
      { session, route, actorSource },
      async (event) => {
        events.push(event);
      },
    );
  }
  assert.deepEqual(
    events.map(({ actorSource, method, action, result, httpStatus }) => ({
      actorSource,
      method,
      action,
      result,
      httpStatus,
    })),
    [
      {
        actorSource: "password_login",
        method: "POST",
        action: "admin_session.login",
        result: "succeeded",
        httpStatus: 303,
      },
      {
        actorSource: "google_login",
        method: "GET",
        action: "admin_session.login",
        result: "succeeded",
        httpStatus: 303,
      },
    ],
  );
  for (const event of events) {
    assert.equal(event.actorId, "Fernando Balino");
    assert.match(event.targetId, /^[a-f0-9]{64}$/);
    assert.equal(event.targetId.includes(session.sessionId), false);
  }
});
