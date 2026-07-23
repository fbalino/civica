import { getRequestIp } from "./request-ip";

const SUBJECT_DOMAIN = "civica-rate-limit-subject/v1";
const DEVELOPMENT_SECRET = [
  "civica-local-rate-limit-key",
  "development-only-2026",
].join("-");
const MINIMUM_SECRET_BYTES = 32;

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigurationError";
  }
}

export interface RateLimitSubjectDependencies {
  /** Test seam. Production callers use RATE_LIMIT_KEY_SECRET. */
  secret?: string;
  environment?: string;
}

function configuredSecret(dependencies: RateLimitSubjectDependencies): string {
  const explicit = dependencies.secret?.trim();
  const configured = explicit || process.env.RATE_LIMIT_KEY_SECRET?.trim();
  const environment = dependencies.environment ?? process.env.NODE_ENV;

  if (!configured) {
    if (environment === "production") {
      throw new RateLimitConfigurationError(
        "RATE_LIMIT_KEY_SECRET is required for production rate limiting",
      );
    }
    return DEVELOPMENT_SECRET;
  }

  if (new TextEncoder().encode(configured).byteLength < MINIMUM_SECRET_BYTES) {
    throw new RateLimitConfigurationError(
      `RATE_LIMIT_KEY_SECRET must be at least ${MINIMUM_SECRET_BYTES} bytes`,
    );
  }
  return configured;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Produce an opaque, domain-separated request subject for shared counters.
 * The validated client address never reaches the rate_limits table.
 * Web Crypto keeps this helper compatible with both Node and Edge handlers.
 */
export async function getRateLimitSubject(
  request: Request,
  scope: string,
  dependencies: RateLimitSubjectDependencies = {},
): Promise<string> {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(scope)) {
    throw new RateLimitConfigurationError("Invalid rate-limit scope");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(configuredSecret(dependencies)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = `${SUBJECT_DOMAIN}\0${scope}\0${getRequestIp(request)}`;
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}
