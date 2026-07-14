import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { adminSessionRevocations } from "@/lib/db/schema";

const SESSION_KEY_DOMAIN = "civica-admin-session-id/v1:";

export interface RevocableAdminSession {
  reviewerId: string;
  /** Unix timestamp in seconds. */
  issuedAt: number;
  /** Unix timestamp in seconds. */
  expiresAt: number;
  sessionId: string;
}

export interface AdminSessionRevocation {
  sessionKey: string;
  reviewerId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date;
}

export interface AdminSessionRevocationStore {
  isRevoked(sessionKey: string): Promise<boolean>;
  revoke(
    record: AdminSessionRevocation,
  ): Promise<"revoked" | "already_revoked">;
}

export const databaseAdminSessionRevocationStore: AdminSessionRevocationStore =
  {
    async isRevoked(sessionKey) {
      const rows = await db
        .select({ sessionKey: adminSessionRevocations.sessionKey })
        .from(adminSessionRevocations)
        .where(eq(adminSessionRevocations.sessionKey, sessionKey))
        .limit(1);
      return Boolean(rows[0]);
    },

    async revoke(record) {
      const inserted = await db
        .insert(adminSessionRevocations)
        .values(record)
        .onConflictDoNothing({ target: adminSessionRevocations.sessionKey })
        .returning({ sessionKey: adminSessionRevocations.sessionKey });
      return inserted[0] ? "revoked" : "already_revoked";
    },
  };

/**
 * Non-reversible correlation key for revocation and audit rows. The signed
 * cookie continues to carry the random ID; persistent storage never does.
 */
export function adminSessionKey(sessionId: string): string {
  return createHash("sha256")
    .update(`${SESSION_KEY_DOMAIN}${sessionId}`)
    .digest("hex");
}

/** A valid signed cookie is authorized only when no durable tombstone exists. */
export async function isAdminSessionRevoked(
  session: RevocableAdminSession,
  store: AdminSessionRevocationStore = databaseAdminSessionRevocationStore,
): Promise<boolean> {
  return store.isRevoked(adminSessionKey(session.sessionId));
}

/**
 * Persist an idempotent logout tombstone. Store failures deliberately
 * propagate: callers must not clear the browser cookie or claim logout when
 * server-side invalidation did not complete.
 */
export async function revokeAdminSession(
  session: RevocableAdminSession,
  nowMs = Date.now(),
  store: AdminSessionRevocationStore = databaseAdminSessionRevocationStore,
): Promise<"revoked" | "already_revoked"> {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error("Admin session revocation time is invalid");
  }

  const issuedAtMs = session.issuedAt * 1000;
  const expiresAtMs = session.expiresAt * 1000;
  if (nowMs >= expiresAtMs) {
    return "already_revoked";
  }

  return store.revoke({
    sessionKey: adminSessionKey(session.sessionId),
    reviewerId: session.reviewerId,
    issuedAt: new Date(issuedAtMs),
    expiresAt: new Date(expiresAtMs),
    // Verification permits up to 60 seconds of positive clock skew. Preserve
    // the real revocation time; the database constraint carries that allowance.
    revokedAt: new Date(nowMs),
  });
}
