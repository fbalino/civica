/**
 * Same-origin request guard for cookie-authenticated admin mutations.
 *
 * Call this after `getAdminSession()` and before reading a request body or
 * touching the database. Modern browsers are checked with the forbidden
 * `Sec-Fetch-Site` request header. Older clients must supply a same-origin
 * `Origin`, or a same-origin `Referer` when `Origin` is absent.
 *
 * The policy deliberately does not trust `same-site`: a compromised sibling
 * subdomain must not be able to submit an authenticated admin mutation.
 */

const ADMIN_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type AdminMutationGuardSource = "fetch-metadata" | "origin" | "referer";

export type AdminMutationGuardDenialReason =
  | "unsupported_method"
  | "invalid_target"
  | "malformed_headers"
  | "cross_site"
  | "same_site"
  | "opaque_fetch_context"
  | "malformed_fetch_metadata"
  | "missing_origin_evidence"
  | "opaque_origin"
  | "malformed_origin"
  | "origin_mismatch"
  | "opaque_referer"
  | "malformed_referer"
  | "referer_mismatch";

export type AdminMutationGuardResult =
  | { ok: true; source: AdminMutationGuardSource }
  | {
      ok: false;
      reason: AdminMutationGuardDenialReason;
      response: Response;
    };

export interface AdminMutationRequestLike {
  readonly method: string;
  readonly url: string;
  readonly headers: Pick<Headers, "get">;
}

type HeaderName = "sec-fetch-site" | "origin" | "referer";

function forbidden(
  reason: AdminMutationGuardDenialReason,
): AdminMutationGuardResult {
  return {
    ok: false,
    reason,
    response: Response.json(
      { error: "Forbidden" },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          Vary: "Sec-Fetch-Site, Origin, Referer",
        },
      },
    ),
  };
}

function readHeader(
  request: AdminMutationRequestLike,
  name: HeaderName,
): string | null | undefined {
  try {
    return request.headers.get(name);
  } catch {
    return undefined;
  }
}

function targetOrigin(request: AdminMutationRequestLike): string | null {
  try {
    const target = new URL(request.url);
    if (
      (target.protocol !== "https:" && target.protocol !== "http:") ||
      target.origin === "null" ||
      target.username !== "" ||
      target.password !== ""
    ) {
      return null;
    }
    return target.origin;
  } catch {
    return null;
  }
}

function checkOrigin(
  raw: string,
  expectedOrigin: string,
): AdminMutationGuardDenialReason | null {
  if (raw === "null") return "opaque_origin";
  try {
    const origin = new URL(raw);
    if (
      (origin.protocol !== "https:" && origin.protocol !== "http:") ||
      origin.origin === "null" ||
      origin.username !== "" ||
      origin.password !== "" ||
      origin.pathname !== "/" ||
      origin.search !== "" ||
      origin.hash !== "" ||
      origin.origin !== raw
    ) {
      return "malformed_origin";
    }
    return origin.origin === expectedOrigin ? null : "origin_mismatch";
  } catch {
    return "malformed_origin";
  }
}

function checkReferer(
  raw: string,
  expectedOrigin: string,
): AdminMutationGuardDenialReason | null {
  if (raw === "null") return "opaque_referer";
  try {
    const referer = new URL(raw);
    if (
      (referer.protocol !== "https:" && referer.protocol !== "http:") ||
      referer.origin === "null" ||
      referer.username !== "" ||
      referer.password !== ""
    ) {
      return "malformed_referer";
    }
    return referer.origin === expectedOrigin ? null : "referer_mismatch";
  } catch {
    return "malformed_referer";
  }
}

/**
 * Evaluate the request and return either the trusted signal or a ready-to-use
 * generic 403 response. Denial reasons are server-side only and are not placed
 * in the response body.
 */
export function guardAdminMutationRequest(
  request: AdminMutationRequestLike,
): AdminMutationGuardResult {
  if (!ADMIN_MUTATION_METHODS.has(request.method)) {
    return forbidden("unsupported_method");
  }

  const expectedOrigin = targetOrigin(request);
  if (!expectedOrigin) return forbidden("invalid_target");

  const fetchSite = readHeader(request, "sec-fetch-site");
  const origin = readHeader(request, "origin");
  const referer = readHeader(request, "referer");
  if (
    fetchSite === undefined ||
    origin === undefined ||
    referer === undefined
  ) {
    return forbidden("malformed_headers");
  }

  if (fetchSite !== null) {
    if (fetchSite === "cross-site") return forbidden("cross_site");
    if (fetchSite === "same-site") return forbidden("same_site");
    if (fetchSite === "none") return forbidden("opaque_fetch_context");
    if (fetchSite !== "same-origin") {
      return forbidden("malformed_fetch_metadata");
    }

    // Metadata is authoritative, but contradictory supplied provenance is
    // still rejected rather than silently ignored.
    if (origin !== null) {
      const reason = checkOrigin(origin, expectedOrigin);
      if (reason) return forbidden(reason);
    }
    if (referer !== null) {
      const reason = checkReferer(referer, expectedOrigin);
      if (reason) return forbidden(reason);
    }
    return { ok: true, source: "fetch-metadata" };
  }

  // Legacy-client fallback. A present but bad Origin never falls through to a
  // good Referer, and when both exist both must agree with the target origin.
  if (origin !== null) {
    const reason = checkOrigin(origin, expectedOrigin);
    if (reason) return forbidden(reason);
    if (referer !== null) {
      const refererReason = checkReferer(referer, expectedOrigin);
      if (refererReason) return forbidden(refererReason);
    }
    return { ok: true, source: "origin" };
  }

  if (referer !== null) {
    const reason = checkReferer(referer, expectedOrigin);
    if (reason) return forbidden(reason);
    return { ok: true, source: "referer" };
  }

  return forbidden("missing_origin_evidence");
}
