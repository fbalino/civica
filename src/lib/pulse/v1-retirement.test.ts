import assert from "node:assert/strict";
import test from "node:test";
import { GET as calculateGet, POST as calculatePost } from "@/app/api/cron/pulse/calculate/route";
import { GET as classifyGet, POST as classifyPost } from "@/app/api/cron/pulse/classify/route";
import { GET as ingestGet, POST as ingestPost } from "@/app/api/cron/pulse/ingest/route";
import {
  PULSE_V1_RETIREMENT_CODE,
  PULSE_V1_RETIREMENT_DOCUMENTATION,
  PULSE_V1_RETIREMENTS,
} from "./v1-retirement";

const originalCronSecret = process.env.CRON_SECRET;

test.after(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

const routes = [
  ["ingest", ingestGet, ingestPost],
  ["classify", classifyGet, classifyPost],
  ["calculate", calculateGet, calculatePost],
] as const;

test("legacy Pulse cron routes authenticate before disclosing retirement", async () => {
  process.env.CRON_SECRET = "test-secret";
  for (const [stage, get, post] of routes) {
    for (const handler of [get, post]) {
      const response = await handler(
        new Request(`https://example.test/api/cron/pulse/${stage}`),
      );
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
      assert.equal(response.headers.get("Deprecation"), null);
    }
  }
});

test("authenticated legacy Pulse cron routes return deterministic retirement contracts", async () => {
  process.env.CRON_SECRET = "test-secret";
  for (const [stage, get, post] of routes) {
    const expected = PULSE_V1_RETIREMENTS[stage];
    const responses = [];
    for (const handler of [get, post]) {
      responses.push(
        await handler(
          new Request(`https://example.test/api/cron/pulse/${stage}`, {
            method: handler === post ? "POST" : "GET",
            headers: { Authorization: "Bearer test-secret" },
          }),
        ),
      );
    }

    const bodies = [];
    for (const response of responses) {
      assert.equal(response.status, 410);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(response.headers.get("Deprecation"), "true");
      assert.equal(
        response.headers.get("Link"),
        `<${expected.successor}>; rel="successor-version", <${PULSE_V1_RETIREMENT_DOCUMENTATION}>; rel="deprecation"`,
      );
      bodies.push(await response.json());
    }

    assert.deepEqual(bodies[0], bodies[1]);
    assert.deepEqual(bodies[0], {
      ok: false,
      code: PULSE_V1_RETIREMENT_CODE,
      error: `${expected.legacyStep} is retired; use ${expected.successor}.`,
      step: expected.legacyStep,
      disposition: "retired",
      successor: expected.successor,
      documentation: PULSE_V1_RETIREMENT_DOCUMENTATION,
    });
  }
});
