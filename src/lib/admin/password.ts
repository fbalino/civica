/**
 * Admin password hashing + verification.
 *
 * The owner account's password is NEVER stored in plaintext — only a
 * salted scrypt hash lives in the `ADMIN_PASSWORD_HASH` env var. This
 * module owns the one-way hash and its constant-time verification. No
 * new npm dependency: Node's built-in `crypto.scrypt` is the KDF.
 *
 * Stored format (self-describing, single line, safe for an env var):
 *
 *   scrypt:<N>:<r>:<p>:<saltHex>:<hashHex>
 *
 * where N/r/p are the scrypt cost parameters and keylen is fixed at
 * 64 bytes. Encoding the cost parameters in the string means a future
 * cost bump can re-hash old passwords without a schema change, and a
 * hash produced today keeps verifying after the defaults move.
 *
 * The delimiter is `:`, NOT the conventional PHC `$`, on purpose: this
 * value lives in `.env.local`, and Next.js's env loader (dotenv-expand)
 * treats `$name` as a variable reference — so a `$`-delimited hash whose
 * salt/hash segment starts with a letter would be silently mangled at
 * load time. `:` has no special meaning in an env value.
 *
 * `hashPassword` is used only by the `admin:set-password` helper script
 * (never at request time). `verifyPassword` runs on every sign-in.
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt cost parameters. N must be a power of two; 2^15 (32768) with
 *  r=8, p=1 is a widely-cited interactive-login baseline. keylen is the
 *  derived-key length in bytes. */
const SCRYPT_N = 1 << 15; // 32768
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_BYTES = 16;

// scrypt needs a bigger memory budget than its default `maxmem` (32 MiB)
// allows once N climbs; the working set is ~128 * N * r bytes. Each call
// passes `maxmem: 256 * N * r` for headroom.

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keylen,
      { N: n, r, p, maxmem: 256 * n * r },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

/**
 * Derive a fresh salted scrypt hash for `plain`, returned in the
 * self-describing `scrypt$N$r$p$saltHex$hashHex` format. Used by the
 * `admin:set-password` script — NOT on the request path.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(
    plain,
    salt,
    KEY_LEN,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
  );
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join(":");
}

/**
 * Constant-time verify `plain` against a stored `scrypt$...` hash.
 *
 * Returns false (never throws) on any malformed input, a missing hash,
 * or a mismatch — so callers can treat it as a plain boolean gate and
 * fail closed. The final comparison is `timingSafeEqual` over the
 * derived keys, so a wrong password can't be distinguished from a right
 * one by response timing.
 */
export async function verifyPassword(
  plain: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash || !plain) return false;

  const parts = storedHash.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];

  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    n <= 1 ||
    (n & (n - 1)) !== 0 || // N must be a power of two
    r <= 0 ||
    p <= 0 ||
    !/^[0-9a-f]+$/i.test(saltHex) ||
    !/^[0-9a-f]+$/i.test(hashHex) ||
    hashHex.length % 2 !== 0
  ) {
    return false;
  }

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }

  let derived: Buffer;
  try {
    const salt = Buffer.from(saltHex, "hex");
    derived = await scryptAsync(plain, salt, expected.length, n, r, p);
  } catch {
    // scrypt can throw on absurd cost params (memory/time). Treat as a
    // verification failure rather than a crash.
    return false;
  }

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
