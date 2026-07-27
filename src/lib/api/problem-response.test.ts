import assert from "node:assert/strict";
import test from "node:test";

import {
  apiProblem,
  withPrivateSafeJsonErrors,
  withSafeJsonErrors,
} from "./problem-response";

test("problem responses use a stable no-store shape", async () => {
  const response = apiProblem("INVALID_QUERY");
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "Invalid query parameters.",
    code: "INVALID_QUERY",
  });
});

test("unknown errors cannot leak text or choose a response status", async () => {
  const secret =
    "postgres://owner:password@db.example.test/civica constraint secret_key";
  const previous = console.error;
  console.error = () => undefined;
  try {
    const response = await withSafeJsonErrors("fixture", async () => {
      throw new Error(`immutable duplicate ${secret}`);
    });
    const body = JSON.stringify(await response.json());
    assert.equal(response.status, 503);
    assert.doesNotMatch(body, /password|constraint|duplicate|immutable/);
    assert.deepEqual(JSON.parse(body), {
      error: "The requested data is temporarily unavailable.",
      code: "DATA_UNAVAILABLE",
    });
  } finally {
    console.error = previous;
  }
});

test("unknown errors retain only route-declared CORS and rights headers", async () => {
  const original = console.error;
  console.error = () => undefined;
  try {
    const response = await withSafeJsonErrors(
      "fixture",
      async () => {
        throw new Error("secret provider detail");
      },
      {
        errorHeaders: {
          "Access-Control-Allow-Origin": "*",
          "X-Civica-Rights-Manifest": "/api/rights-manifest",
        },
      },
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(
      response.headers.get("X-Civica-Rights-Manifest"),
      "/api/rights-manifest",
    );
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(
      JSON.stringify(await response.json()).includes("secret"),
      false,
    );
  } finally {
    console.error = original;
  }
});

test("expected route-specific errors are forced to no-store", async () => {
  const response = await withSafeJsonErrors("fixture", () =>
    Response.json(
      { error: "Country not found", code: "COUNTRY_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "public, max-age=3600" } },
    ),
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: "Country not found",
    code: "COUNTRY_NOT_FOUND",
  });
});

test("safe JSON boundaries seal successful public and private responses", async () => {
  const publicResponse = await withSafeJsonErrors("fixture", () =>
    Response.json({ ok: true }),
  );
  assert.equal(publicResponse.headers.get("Cache-Control"), "no-store");

  const privateResponse = await withPrivateSafeJsonErrors("fixture", () =>
    Response.json(
      { ok: true },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    ),
  );
  assert.equal(
    privateResponse.headers.get("Cache-Control"),
    "private, no-store",
  );
});
