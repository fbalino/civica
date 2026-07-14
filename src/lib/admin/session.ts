/**
 * Admin session helpers.
 *
 * Browser-friendly auth for the /admin/* routes. Access is a single owner
 * account: a username (`ADMIN_USERNAME`) plus a password whose salted scrypt
 * hash lives in `ADMIN_PASSWORD_HASH` (see `src/lib/admin/password.ts`).
 *
 * Cookie format: `v1.<base64url-json>.<hmac>`. The signed JSON payload carries
 * the server-configured audit identity, issued-at time, expiry time, and a
 * cryptographically random session ID. The HMAC covers both the outer format
 * version and the payload. Verification checks the signature, payload schema,
 * configured identity, issued-at boundary, fixed seven-day lifetime, expiry,
 * and session-ID shape on every request. Browser Max-Age is only a client-side
 * convenience; it is never the authority for session expiry.
 *
 * The legacy `civica_admin_reviewer` cookie is cleared when a new session is
 * issued and is never read. Audit identity comes only from the signed payload
 * after it matches current server configuration, so an unsigned client cookie
 * cannot alter an audit actor.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "civica_admin_session";
/** Retained only so existing browsers can have the obsolete cookie cleared. */
export const ADMIN_REVIEWER_COOKIE = "civica_admin_reviewer";
export const ADMIN_SESSION_VERSION = "civica-admin-session/v1" as const;
export const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const COOKIE_FORMAT_VERSION = "v1";
const MAX_CLOCK_SKEW_SECONDS = 60;
const SESSION_ID_PATTERN = /^[0-9a-f]{36}$/;
const PAYLOAD_KEYS = [
  "expiresAt",
  "issuedAt",
  "reviewerId",
  "sessionId",
  "version",
] as const;

export interface AdminSession {
  version: typeof ADMIN_SESSION_VERSION;
  reviewerId: string;
  /** Unix timestamp in seconds. */
  issuedAt: number;
  /** Unix timestamp in seconds. */
  expiresAt: number;
  sessionId: string;
}

export interface SessionCookieVerification {
  valid: boolean;
  session: AdminSession | null;
}

function invalidSession(): SessionCookieVerification {
  return { valid: false, session: null };
}

/** Sign the complete versioned payload envelope with the dedicated secret. */
function signValue(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Constant-time string compare that tolerates length mismatches. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * The server-configured reviewer identity for signed sessions and audit rows.
 * `ADMIN_DISPLAY_NAME` is preferred, then `ADMIN_USERNAME`. Missing or wholly
 * invalid configuration returns null; there is deliberately no hardcoded
 * production actor such as "admin".
 */
export function adminReviewerName(): string | null {
  const displayName = sanitizeReviewerName(process.env.ADMIN_DISPLAY_NAME, "");
  if (displayName) return displayName;
  const username = sanitizeReviewerName(process.env.ADMIN_USERNAME, "");
  return username || null;
}

/** A session can be minted only with both a signing key and an identity. */
export function isAdminSessionConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET && adminReviewerName());
}

/**
 * Constant-time verify a submitted username against `ADMIN_USERNAME`.
 * Returns false when `ADMIN_USERNAME` is unset. Password verification remains
 * a separate, timing-safe scrypt check in `src/lib/admin/password.ts`.
 */
export function verifyAdminUsername(
  username: string | null | undefined,
): boolean {
  const expected = process.env.ADMIN_USERNAME;
  if (!expected) return false;
  return safeEqual((username ?? "").trim(), expected);
}

/**
 * Sanitise an operator-supplied reviewer name to a bounded, audit-safe shape:
 * keep only `[a-zA-Z0-9 _.\-]`, trim, and cap at 80 characters.
 */
export function sanitizeReviewerName(
  raw: string | null | undefined,
  fallback: string,
): string {
  return (
    (raw ?? "")
      .replace(/[^a-zA-Z0-9 _.\-]/g, "")
      .trim()
      .slice(0, 80) || fallback
  );
}

function parsePayload(encoded: string): AdminSession | null {
  if (
    encoded.length === 0 ||
    encoded.length > 2048 ||
    !/^[A-Za-z0-9_-]+$/.test(encoded)
  ) {
    return null;
  }

  let decoded: Buffer;
  let value: unknown;
  try {
    decoded = Buffer.from(encoded, "base64url");
    // Buffer decoding is deliberately permissive; require canonical encoding.
    if (decoded.toString("base64url") !== encoded) return null;
    value = JSON.parse(decoded.toString("utf8"));
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== PAYLOAD_KEYS.length ||
    PAYLOAD_KEYS.some((key) => !Object.hasOwn(record, key))
  ) {
    return null;
  }

  if (record.version !== ADMIN_SESSION_VERSION) return null;
  if (
    typeof record.reviewerId !== "string" ||
    record.reviewerId.length === 0 ||
    record.reviewerId.length > 80 ||
    sanitizeReviewerName(record.reviewerId, "") !== record.reviewerId
  ) {
    return null;
  }
  if (
    typeof record.issuedAt !== "number" ||
    !Number.isSafeInteger(record.issuedAt) ||
    record.issuedAt < 0 ||
    typeof record.expiresAt !== "number" ||
    !Number.isSafeInteger(record.expiresAt) ||
    record.expiresAt - record.issuedAt !== ADMIN_SESSION_TTL_SECONDS
  ) {
    return null;
  }
  if (
    typeof record.sessionId !== "string" ||
    !SESSION_ID_PATTERN.test(record.sessionId)
  ) {
    return null;
  }

  return {
    version: ADMIN_SESSION_VERSION,
    reviewerId: record.reviewerId,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    sessionId: record.sessionId,
  };
}

/**
 * Pure parse, signature, payload, identity, and time verification. `nowMs` is
 * injectable so expiry and issued-at boundaries have deterministic tests.
 */
export function verifySessionCookie(
  cookieValue: string | null | undefined,
  secret: string | null | undefined,
  nowMs = Date.now(),
): SessionCookieVerification {
  if (!secret || !cookieValue || !Number.isFinite(nowMs) || nowMs < 0) {
    return invalidSession();
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return invalidSession();
  const [formatVersion, encodedPayload, presentedMac] = parts;
  if (
    formatVersion !== COOKIE_FORMAT_VERSION ||
    !/^[0-9a-f]{64}$/.test(presentedMac)
  ) {
    return invalidSession();
  }

  const signedValue = `${formatVersion}.${encodedPayload}`;
  const expectedMac = signValue(secret, signedValue);
  if (!safeEqual(presentedMac, expectedMac)) return invalidSession();

  const session = parsePayload(encodedPayload);
  if (!session) return invalidSession();

  const expectedIdentity = adminReviewerName();
  if (!expectedIdentity || !safeEqual(session.reviewerId, expectedIdentity)) {
    return invalidSession();
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (
    !Number.isSafeInteger(nowSeconds) ||
    session.issuedAt > nowSeconds + MAX_CLOCK_SKEW_SECONDS ||
    session.expiresAt <= nowSeconds
  ) {
    return invalidSession();
  }

  return { valid: true, session };
}

/** Read and validate the admin session cookie against current server state. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const cookieJar = await cookies();
  const cookieValue = cookieJar.get(ADMIN_SESSION_COOKIE)?.value;
  const result = verifySessionCookie(cookieValue, secret);
  return result.valid ? result.session : null;
}

/**
 * Mint a fresh signed v1 session. Identity is always derived inside this
 * function from server configuration; callers cannot supply an audit actor.
 */
export function buildAdminCookieHeaders(
  nowMs = Date.now(),
): Array<[string, string]> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const reviewerId = adminReviewerName();
  if (!secret || !reviewerId || !Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error(
      "Admin session identity or signing secret is not configured",
    );
  }

  const issuedAt = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(issuedAt)) {
    throw new Error("Admin session issuance time is outside the safe range");
  }
  const payload: AdminSession = {
    version: ADMIN_SESSION_VERSION,
    reviewerId,
    issuedAt,
    expiresAt: issuedAt + ADMIN_SESSION_TTL_SECONDS,
    sessionId: randomBytes(18).toString("hex"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signedValue = `${COOKIE_FORMAT_VERSION}.${encodedPayload}`;
  const sessionValue = `${signedValue}.${signValue(secret, signedValue)}`;

  // SameSite=Lax permits the Google top-level callback while still blocking
  // cookies on cross-site mutation requests. Secure is production-only so
  // local HTTP development continues to work.
  const common = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const clearLegacy = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return [
    [
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionValue)}; ${common}${secure}`,
    ],
    ["Set-Cookie", `${ADMIN_REVIEWER_COOKIE}=; ${clearLegacy}`],
  ];
}

export function buildAdminClearCookieHeaders(): Array<[string, string]> {
  const common = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    ["Set-Cookie", `${ADMIN_SESSION_COOKIE}=; ${common}${secure}`],
    ["Set-Cookie", `${ADMIN_REVIEWER_COOKIE}=; ${common}${secure}`],
  ];
}
