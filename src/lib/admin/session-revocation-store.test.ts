import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ADMIN_SESSION_VERSION,
  mintAdminSessionCookie,
  verifyActiveSessionCookie,
} from "./session";
import {
  adminSessionKey,
  isAdminSessionRevoked,
  revokeAdminSession,
  type AdminSessionRevocation,
  type AdminSessionRevocationStore,
} from "./session-revocation-store";

const NOW_MS = Date.UTC(2026, 6, 14, 12, 0, 0);
const SECRET = "revocation-test-secret";

function withAdminEnv<T>(fn: () => T): T {
  const previous = {
    username: process.env.ADMIN_USERNAME,
    displayName: process.env.ADMIN_DISPLAY_NAME,
    secret: process.env.ADMIN_SESSION_SECRET,
  };
  try {
    process.env.ADMIN_USERNAME = "fernando";
    delete process.env.ADMIN_DISPLAY_NAME;
    process.env.ADMIN_SESSION_SECRET = SECRET;
    return fn();
  } finally {
    if (previous.username === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = previous.username;
    if (previous.displayName === undefined)
      delete process.env.ADMIN_DISPLAY_NAME;
    else process.env.ADMIN_DISPLAY_NAME = previous.displayName;
    if (previous.secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous.secret;
  }
}

function cookieValue(headers: Array<[string, string]>): string {
  const raw = headers[0][1];
  return decodeURIComponent(raw.slice(raw.indexOf("=") + 1, raw.indexOf(";")));
}

function memoryStore(): AdminSessionRevocationStore & {
  rows: Map<string, AdminSessionRevocation>;
  reads: number;
} {
  const rows = new Map<string, AdminSessionRevocation>();
  return {
    rows,
    reads: 0,
    async isRevoked(key) {
      this.reads += 1;
      return rows.has(key);
    },
    async revoke(record) {
      if (rows.has(record.sessionKey)) return "already_revoked";
      rows.set(record.sessionKey, record);
      return "revoked";
    },
  };
}

test("session correlation keys are stable, domain-separated hashes", () => {
  const raw = "a".repeat(36);
  const key = adminSessionKey(raw);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, adminSessionKey(raw));
  assert.notEqual(key, adminSessionKey("b".repeat(36)));
  assert.equal(key.includes(raw), false);
});

test("active verification accepts a non-revoked cookie then rejects its copied value after logout", async () => {
  const store = memoryStore();
  const minted = withAdminEnv(() => mintAdminSessionCookie(NOW_MS));
  const copiedCookie = cookieValue(minted.headers);

  const before = await withAdminEnv(() =>
    verifyActiveSessionCookie(copiedCookie, SECRET, NOW_MS, store),
  );
  assert.equal(before.valid, true);

  assert.equal(
    await revokeAdminSession(minted.session, NOW_MS + 1_000, store),
    "revoked",
  );
  const after = await withAdminEnv(() =>
    verifyActiveSessionCookie(copiedCookie, SECRET, NOW_MS + 2_000, store),
  );
  assert.deepEqual(after, { valid: false, session: null });
  assert.equal(store.rows.size, 1);
  const record = store.rows.get(adminSessionKey(minted.session.sessionId));
  assert.equal(record?.reviewerId, "fernando");
  assert.equal(record?.issuedAt.toISOString(), new Date(NOW_MS).toISOString());
});

test("invalid and expired cookies never query the revocation store", async () => {
  const store = memoryStore();
  const minted = withAdminEnv(() => mintAdminSessionCookie(NOW_MS));
  const genuine = cookieValue(minted.headers);

  assert.deepEqual(
    await withAdminEnv(() =>
      verifyActiveSessionCookie("tampered", SECRET, NOW_MS, store),
    ),
    { valid: false, session: null },
  );
  assert.deepEqual(
    await withAdminEnv(() =>
      verifyActiveSessionCookie(
        genuine,
        SECRET,
        minted.session.expiresAt * 1000,
        store,
      ),
    ),
    { valid: false, session: null },
  );
  assert.equal(store.reads, 0);
});

test("a revocation-store outage fails active authorization closed", async () => {
  const minted = withAdminEnv(() => mintAdminSessionCookie(NOW_MS));
  const failing: AdminSessionRevocationStore = {
    async isRevoked() {
      throw new Error("store offline");
    },
    async revoke() {
      throw new Error("store offline");
    },
  };
  await assert.rejects(
    withAdminEnv(() =>
      verifyActiveSessionCookie(
        cookieValue(minted.headers),
        SECRET,
        NOW_MS,
        failing,
      ),
    ),
    /store offline/,
  );
});

test("revoking one independently minted session leaves the other active", async () => {
  const store = memoryStore();
  const first = withAdminEnv(() => mintAdminSessionCookie(NOW_MS).session);
  const second = withAdminEnv(() => mintAdminSessionCookie(NOW_MS).session);
  assert.equal(first.version, ADMIN_SESSION_VERSION);
  assert.notEqual(first.sessionId, second.sessionId);

  await revokeAdminSession(first, NOW_MS + 1_000, store);
  assert.equal(await isAdminSessionRevoked(first, store), true);
  assert.equal(await isAdminSessionRevoked(second, store), false);
  assert.equal(
    await revokeAdminSession(first, NOW_MS + 2_000, store),
    "already_revoked",
  );
});
