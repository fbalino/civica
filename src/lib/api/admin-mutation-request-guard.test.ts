import assert from "node:assert/strict";
import test from "node:test";

import {
  guardAdminMutationRequest,
  type AdminMutationGuardDenialReason,
  type AdminMutationRequestLike,
} from "./admin-mutation-request-guard";

const TARGET = "https://civicaatlas.org/api/admin/messages/123";

function request(
  headers: HeadersInit = {},
  options: { method?: string; url?: string } = {},
): Request {
  return new Request(options.url ?? TARGET, {
    method: options.method ?? "POST",
    headers,
  });
}

function allowed(input: AdminMutationRequestLike, source: string): void {
  const result = guardAdminMutationRequest(input);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.source, source);
}

function denied(
  input: AdminMutationRequestLike,
  reason: AdminMutationGuardDenialReason,
): void {
  const result = guardAdminMutationRequest(input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, reason);
  assert.equal(result.response.status, 403);
  assert.equal(result.response.headers.get("cache-control"), "no-store");
  assert.equal(
    result.response.headers.get("vary"),
    "Sec-Fetch-Site, Origin, Referer",
  );
}

test("allows an unsafe same-origin Fetch Metadata request", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    allowed(
      request({ "Sec-Fetch-Site": "same-origin" }, { method }),
      "fetch-metadata",
    );
  }
  allowed(
    request({
      "Sec-Fetch-Site": "same-origin",
      Origin: "https://civicaatlas.org",
      Referer: "https://civicaatlas.org/admin/messages?status=new",
    }),
    "fetch-metadata",
  );
});

test("rejects cross-site, sibling-site, opaque, and malformed Fetch Metadata", () => {
  for (const [value, reason] of [
    ["cross-site", "cross_site"],
    ["same-site", "same_site"],
    ["none", "opaque_fetch_context"],
    ["", "malformed_fetch_metadata"],
    ["Same-Origin", "malformed_fetch_metadata"],
    ["same-origin, cross-site", "malformed_fetch_metadata"],
    ["future-value", "malformed_fetch_metadata"],
  ] as const) {
    denied(
      request({
        "Sec-Fetch-Site": value,
        Origin: "https://civicaatlas.org",
      }),
      reason,
    );
  }
});

test("same-origin Fetch Metadata cannot mask contradictory provenance", () => {
  denied(
    request({
      "Sec-Fetch-Site": "same-origin",
      Origin: "https://attacker.example",
    }),
    "origin_mismatch",
  );
  denied(
    request({
      "Sec-Fetch-Site": "same-origin",
      Referer: "https://attacker.example/admin",
    }),
    "referer_mismatch",
  );
});

test("falls back to an exact same-origin Origin when metadata is absent", () => {
  allowed(request({ Origin: "https://civicaatlas.org" }), "origin");

  for (const [value, reason] of [
    ["null", "opaque_origin"],
    ["not a URL", "malformed_origin"],
    ["https://civicaatlas.org/path", "malformed_origin"],
    ["https://user@civicaatlas.org", "malformed_origin"],
    ["http://civicaatlas.org", "origin_mismatch"],
    ["https://civicaatlas.org:444", "origin_mismatch"],
    ["https://admin.civicaatlas.org", "origin_mismatch"],
    ["https://civicaatlas.org.attacker.example", "origin_mismatch"],
  ] as const) {
    denied(request({ Origin: value }), reason);
  }
});

test("uses Referer only when Origin is absent", () => {
  allowed(
    request({ Referer: "https://civicaatlas.org/admin/pulse-review/123" }),
    "referer",
  );
  denied(request({ Referer: "null" }), "opaque_referer");
  denied(request({ Referer: "::::" }), "malformed_referer");
  denied(
    request({ Referer: "https://attacker.example/form" }),
    "referer_mismatch",
  );

  denied(
    request({
      Origin: "not a URL",
      Referer: "https://civicaatlas.org/admin/messages",
    }),
    "malformed_origin",
  );
  denied(
    request({
      Origin: "https://civicaatlas.org",
      Referer: "https://attacker.example/form",
    }),
    "referer_mismatch",
  );
});

test("fails closed without provenance, for non-mutation methods, or bad targets", () => {
  denied(request(), "missing_origin_evidence");

  for (const method of ["GET", "HEAD", "OPTIONS", "TRACE", "post"]) {
    denied(
      {
        method,
        url: TARGET,
        headers: new Headers({ "Sec-Fetch-Site": "same-origin" }),
      },
      "unsupported_method",
    );
  }

  denied(
    {
      method: "POST",
      url: "not a URL",
      headers: new Headers({ "Sec-Fetch-Site": "same-origin" }),
    },
    "invalid_target",
  );
  denied(
    {
      method: "POST",
      url: "data:text/plain,opaque",
      headers: new Headers({ "Sec-Fetch-Site": "same-origin" }),
    },
    "invalid_target",
  );
});

test("malformed header access fails closed and the response stays generic", async () => {
  const result = guardAdminMutationRequest({
    method: "POST",
    url: TARGET,
    headers: {
      get() {
        throw new Error("broken header adapter");
      },
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "malformed_headers");
  const body = await result.response.json();
  assert.deepEqual(body, { error: "Forbidden", code: "FORBIDDEN" });
  assert.doesNotMatch(
    JSON.stringify(body).toLowerCase(),
    /origin|referer|fetch|malformed/,
  );
});
