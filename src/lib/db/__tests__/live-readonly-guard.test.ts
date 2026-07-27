/**
 * QA-004 — runtime guard tests for the live read-only test client. DB-free:
 * uses a fake DATABASE_URL and never connects (neon() is lazy).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  getLiveReadOnlyDb,
  reportLiveTestEnvironment,
  REFUSED_MUTATION_METHODS,
} from "../live-readonly";

const FAKE_URL =
  "postgres://fixtureuser:s3cr3tpassword@ep-fake-endpoint-999.us-east-2.aws.neon.tech/fixturedb?sslmode=require";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("getLiveReadOnlyDb refuses to construct outside the opt-in harness", () => {
  withEnv({ RUN_DB_TESTS: undefined, DATABASE_URL: FAKE_URL }, () => {
    assert.throws(() => getLiveReadOnlyDb(), /RUN_DB_TESTS=1/);
  });
});

test("getLiveReadOnlyDb refuses when DATABASE_URL is missing", () => {
  withEnv({ RUN_DB_TESTS: "1", DATABASE_URL: undefined }, () => {
    assert.throws(() => getLiveReadOnlyDb(), /DATABASE_URL is not set/);
  });
});

test("the live client refuses every mutation method but allows reads", () => {
  withEnv({ RUN_DB_TESTS: "1", DATABASE_URL: FAKE_URL }, () => {
    const client = getLiveReadOnlyDb();
    for (const method of REFUSED_MUTATION_METHODS) {
      assert.throws(
        // Property access itself throws via the proxy.
        () => (client as unknown as Record<string, unknown>)[method],
        /read-only/,
        `${method} should be refused`,
      );
    }
    // Reads remain available.
    assert.equal(typeof client.select, "function");
  });
});

test("reportLiveTestEnvironment redacts credentials and the unique endpoint", () => {
  const out = reportLiveTestEnvironment(FAKE_URL);
  assert.doesNotMatch(out, /s3cr3tpassword/);
  assert.doesNotMatch(out, /fixtureuser/);
  assert.doesNotMatch(out, /ep-fake-endpoint-999/);
  // Provider + db name remain, so the environment is identifiable.
  assert.match(out, /neon\.tech/);
  assert.match(out, /fixturedb/);
});

test("reportLiveTestEnvironment handles missing / unparseable URLs safely", () => {
  assert.match(reportLiveTestEnvironment(undefined), /no DATABASE_URL/);
  assert.match(reportLiveTestEnvironment("not a url"), /redacted/);
});
