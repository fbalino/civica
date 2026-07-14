import assert from "node:assert/strict";
import test from "node:test";

import { PulseCodingStoreError } from "@/lib/pulse/v2/coding-errors";
import { pulseCodingProblem } from "./pulse-coding-problem";

async function body(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

test("typed Pulse coding failures map to fixed stable problems", async () => {
  const cases = [
    ["FORBIDDEN", 403, "FORBIDDEN"],
    ["NOT_FOUND", 404, "NOT_FOUND"],
    ["CONFLICT", 409, "CONFLICT"],
    ["INVALID_REQUEST_BODY", 422, "INVALID_REQUEST_BODY"],
  ] as const;

  for (const [storeCode, status, publicCode] of cases) {
    const response = pulseCodingProblem(
      "fixture",
      new PulseCodingStoreError(storeCode, "private diagnostic detail"),
    );
    assert.equal(response.status, status);
    const payload = await body(response);
    assert.equal(payload.code, publicCode);
    assert.doesNotMatch(JSON.stringify(payload), /private diagnostic detail/);
  }
});

test("unknown Pulse coding failures never leak or select a status", async () => {
  const secret = "postgres://owner:password@db.example/civica";
  const previous = console.error;
  console.error = () => undefined;
  try {
    const response = pulseCodingProblem("fixture", new Error(secret));
    assert.equal(response.status, 503);
    const payload = await body(response);
    assert.deepEqual(payload, {
      error: "The requested data is temporarily unavailable.",
      code: "DATA_UNAVAILABLE",
    });
    assert.doesNotMatch(JSON.stringify(payload), /password|postgres/);
  } finally {
    console.error = previous;
  }
});
