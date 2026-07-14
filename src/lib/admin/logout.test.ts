import assert from "node:assert/strict";
import { test } from "node:test";

import { ADMIN_SESSION_VERSION, type AdminSession } from "./session";
import { runAdminLogout, type AdminLogoutDependencies } from "./logout";
import type {
  AdminSessionRevocation,
  AdminSessionRevocationStore,
} from "./session-revocation-store";
import type { AdminAuditEvent } from "./mutation-audit";

const NOW_MS = Date.UTC(2026, 6, 14, 12, 0, 0);
const session: AdminSession = {
  version: ADMIN_SESSION_VERSION,
  reviewerId: "Fernando Balino",
  issuedAt: NOW_MS / 1000,
  expiresAt: NOW_MS / 1000 + 7 * 24 * 60 * 60,
  sessionId: "a".repeat(36),
};

function request(site = "same-origin"): Request {
  return new Request("https://civicaatlas.org/api/admin/sign-out", {
    method: "POST",
    headers: { "Sec-Fetch-Site": site },
  });
}

function fixture(
  options: {
    session?: AdminSession | null;
    revokeError?: Error;
    auditErrorAt?: number;
  } = {},
) {
  const rows = new Map<string, AdminSessionRevocation>();
  const audits: AdminAuditEvent[] = [];
  let auditCalls = 0;
  let revokeCalls = 0;
  const revocations: AdminSessionRevocationStore = {
    async isRevoked(key) {
      return rows.has(key);
    },
    async revoke(record) {
      revokeCalls += 1;
      if (options.revokeError) throw options.revokeError;
      if (rows.has(record.sessionKey)) return "already_revoked";
      rows.set(record.sessionKey, record);
      return "revoked";
    },
  };
  const dependencies: AdminLogoutDependencies = {
    async getSession() {
      return options.session === undefined ? session : options.session;
    },
    revocations,
    async writeAudit(event) {
      auditCalls += 1;
      if (options.auditErrorAt === auditCalls) throw new Error("audit offline");
      audits.push(event);
    },
    requestId: () =>
      `00000000-0000-4000-8000-${String(auditCalls).padStart(12, "0")}`,
    now: () => NOW_MS + 1_000,
    logError() {},
  };
  return {
    rows,
    audits,
    dependencies,
    revokeCalls: () => revokeCalls,
  };
}

test("same-origin logout persists revocation and audit before clearing cookies", async () => {
  const state = fixture();
  const response = await runAdminLogout(
    request(),
    "/api/admin/sign-out",
    state.dependencies,
  );
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://civicaatlas.org/admin/sign-in",
  );
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /civica_admin_session=/,
  );
  assert.equal(state.rows.size, 1);
  assert.deepEqual(
    state.audits.map(({ event, result, httpStatus }) => ({
      event,
      result,
      httpStatus,
    })),
    [
      { event: "attempt", result: "attempted", httpStatus: null },
      { event: "outcome", result: "succeeded", httpStatus: 303 },
    ],
  );
  assert.equal(state.audits[1].actorId, "Fernando Balino");
  assert.equal(state.audits[1].action, "admin_session.logout");
  assert.match(state.audits[1].targetId, /^[a-f0-9]{64}$/);

  const second = await runAdminLogout(
    request(),
    "/api/admin/sign-out",
    state.dependencies,
  );
  assert.equal(second.status, 303);
  assert.equal(state.rows.size, 1);
});

test("logout rejects cross-site requests before revocation or cookie clearing", async () => {
  const state = fixture();
  const response = await runAdminLogout(
    request("cross-site"),
    "/api/admin/sign-out",
    state.dependencies,
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(state.revokeCalls(), 0);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].result, "rejected");
  assert.equal(state.audits[0].reasonCode, "csrf_cross_site");
});

test("missing or expired session logout remains an idempotent clear", async () => {
  const state = fixture({ session: null });
  const response = await runAdminLogout(
    request(),
    "/api/admin/sign-out",
    state.dependencies,
  );
  assert.equal(response.status, 303);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.equal(state.revokeCalls(), 0);
  assert.deepEqual(state.audits, []);
});

test("revocation failure returns 503 and never clears the browser cookie", async () => {
  const state = fixture({ revokeError: new Error("store offline") });
  const response = await runAdminLogout(
    request(),
    "/api/admin/sign-out",
    state.dependencies,
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(state.audits.at(-1)?.result, "failed");
  assert.equal(state.audits.at(-1)?.reasonCode, "revocation_store_unavailable");
});

test("attempt-audit failure prevents revocation and cookie clearing", async () => {
  const state = fixture({ auditErrorAt: 1 });
  const response = await runAdminLogout(
    request(),
    "/api/admin/sign-out",
    state.dependencies,
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(state.revokeCalls(), 0);
});
