import assert from "node:assert/strict";
import { test } from "node:test";

import { getRequestIp } from "./request-ip";

const ENVIRONMENT_KEYS = ["NODE_ENV", "VERCEL", "VERCEL_ENV"] as const;

function withEnvironment(
  values: Partial<Record<(typeof ENVIRONMENT_KEYS)[number], string>>,
  run: () => void,
) {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(
    ENVIRONMENT_KEYS.map((key) => [key, mutableEnvironment[key]]),
  );

  for (const key of ENVIRONMENT_KEYS) {
    const value = values[key];
    if (value === undefined) delete mutableEnvironment[key];
    else mutableEnvironment[key] = value;
  }

  try {
    run();
  } finally {
    for (const key of ENVIRONMENT_KEYS) {
      const value = previous[key];
      if (value === undefined) delete mutableEnvironment[key];
      else mutableEnvironment[key] = value;
    }
  }
}

function request(headers: HeadersInit = {}) {
  return new Request("https://civicaatlas.org/api/test", { headers });
}

test("local requests accept one valid forwarded address", () => {
  withEnvironment({ NODE_ENV: "test" }, () => {
    assert.equal(
      getRequestIp(request({ "x-forwarded-for": " 203.0.113.42 " })),
      "203.0.113.42",
    );
    assert.equal(
      getRequestIp(request({ "x-real-ip": "2001:db8::42" })),
      "2001:db8::42",
    );
  });
});

test("equivalent IPv6 text shares one canonical bucket", () => {
  withEnvironment({ NODE_ENV: "test" }, () => {
    const expanded = getRequestIp(
      request({
        "x-forwarded-for": "2001:0DB8:0000:0000:0000:FF00:0042:8329",
      }),
    );
    const compressed = getRequestIp(
      request({ "x-forwarded-for": "2001:db8::ff00:42:8329" }),
    );

    assert.equal(expanded, "2001:db8::ff00:42:8329");
    assert.equal(expanded, compressed);
  });
});

test("proxy chains are rejected instead of selecting a client-chosen hop", () => {
  withEnvironment({ NODE_ENV: "test" }, () => {
    assert.equal(
      getRequestIp(request({ "x-forwarded-for": "192.0.2.1, 198.51.100.20" })),
      "unknown",
    );
    assert.equal(
      getRequestIp(
        request({
          "x-forwarded-for": "192.0.2.1, 198.51.100.20",
          "x-real-ip": "203.0.113.9",
        }),
      ),
      "unknown",
      "an invalid higher-priority header must not downgrade to another value",
    );
  });
});

test("malformed address forms share the unknown bucket", () => {
  withEnvironment({ NODE_ENV: "test" }, () => {
    for (const value of [
      "",
      "not-an-ip",
      "203.0.113.42:443",
      "[2001:db8::42]:443",
      "fe80::1%eth0",
      "2001:db8:::42",
      "256.0.0.1",
      "203.0.113.042",
    ]) {
      assert.equal(
        getRequestIp(request({ "x-forwarded-for": value })),
        "unknown",
        value,
      );
    }

    assert.equal(getRequestIp(request()), "unknown");
  });
});

test("Vercel prefers its dedicated client-IP header over spoofed aliases", () => {
  withEnvironment(
    { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" },
    () => {
      assert.equal(
        getRequestIp(
          request({
            "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:7",
            "x-forwarded-for": "192.0.2.123",
            "x-real-ip": "198.51.100.123",
          }),
        ),
        "2001:db8::7",
      );
    },
  );
});

test("Vercel accepts only a single address and never downgrades malformed provenance", () => {
  withEnvironment(
    { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" },
    () => {
      assert.equal(
        getRequestIp(
          request({
            "x-vercel-forwarded-for": "192.0.2.1, 198.51.100.20",
            "x-forwarded-for": "203.0.113.10",
          }),
        ),
        "unknown",
      );
    },
  );
});

test("Vercel falls back only to edge-overwritten IP aliases", () => {
  withEnvironment(
    { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" },
    () => {
      assert.equal(
        getRequestIp(request({ "x-forwarded-for": "198.51.100.20" })),
        "198.51.100.20",
      );
      assert.equal(
        getRequestIp(request({ "x-real-ip": "198.51.100.21" })),
        "198.51.100.21",
      );
    },
  );
});

test("non-Vercel production does not trust client-selected proxy headers", () => {
  withEnvironment({ NODE_ENV: "production" }, () => {
    assert.equal(
      getRequestIp(
        request({
          "x-vercel-forwarded-for": "203.0.113.1",
          "x-forwarded-for": "203.0.113.2",
          "x-real-ip": "203.0.113.3",
        }),
      ),
      "unknown",
    );
  });
});

test("local requests ignore a client-spoofed Vercel-only header", () => {
  withEnvironment({ NODE_ENV: "test" }, () => {
    assert.equal(
      getRequestIp(
        request({
          "x-vercel-forwarded-for": "192.0.2.111",
          "x-forwarded-for": "198.51.100.42",
        }),
      ),
      "198.51.100.42",
    );
    assert.equal(
      getRequestIp(request({ "x-vercel-forwarded-for": "192.0.2.111" })),
      "unknown",
    );
  });
});
