/**
 * PLT-027 — central same-origin redirect validator.
 *
 * The admin flows accept a `?redirect=` target after login. The previous
 * `raw.startsWith("/")` checks accepted scheme-relative (`//evil.com`) and
 * backslash (`/\evil.com`) targets, which browsers resolve to an external
 * origin — an open redirect. This is the single gate: it returns a safe
 * same-origin path or `null`, and callers fall back to a fixed default.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Return a safe same-origin path (leading `/`, single-segment root, no
 * authority) or `null`. Rejects: absolute URLs, scheme-relative `//host`,
 * backslash `\` (which browsers treat like `/`), encoded authority, control
 * characters, and anything not starting with exactly one `/`.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Decode once so an encoded `%2F%2Fevil.com` or `%5C` is caught. A malformed
  // sequence throws — treat as unsafe.
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (CONTROL_CHARS.test(value)) return null;
  // Backslashes are normalized to `/` by browsers; forbid them outright.
  if (value.includes("\\")) return null;
  // Must be a rooted path, and the second character must not begin an
  // authority (`//host`) — so exactly one leading slash.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  // A rooted path cannot legally contain a scheme.
  if (/^\/[^/]*:/.test(value)) return null;

  return value;
}

/**
 * Convenience: a validated path, or the provided fallback (default `/admin`).
 */
export function safeInternalPathOr(
  raw: string | null | undefined,
  fallback = "/admin",
): string {
  return safeInternalPath(raw) ?? fallback;
}
