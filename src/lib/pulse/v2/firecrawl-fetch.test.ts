import assert from "node:assert/strict";
import test from "node:test";

import {
  firecrawlConfigured,
  firecrawlRawFetch,
  isPublisherBlock,
} from "./firecrawl-fetch";
import {
  PUBLISHER_FALLBACK_PERMISSIONS,
  publisherFallbackDecision,
  publisherFallbackPermitted,
  type PublisherFallbackPermission,
} from "./publisher-fallback-permission";

/** A fixture registry. The production registry grants nobody today. */
const FIXTURE_PERMISSIONS: readonly PublisherFallbackPermission[] = [
  {
    host: "granted-publisher.test",
    state: "granted",
    permissionEvidence:
      "Granted by the fixture publisher's web team on 2026-08-18; recorded in this test.",
  },
  {
    host: "pending-publisher.test",
    state: "requested_pending",
    note: "Allowlisting requested 2026-08-18; no answer yet.",
  },
  {
    host: "refused-publisher.test",
    state: "denied",
    note: "The publisher declined on 2026-08-18.",
  },
];

const okFetch = (async () =>
  new Response(
    JSON.stringify({ success: true, data: { rawHtml: "<rss>ok</rss>" } }),
    { status: 200 },
  )) as unknown as typeof fetch;

/** Await the body before restoring: a sync `finally` would clear the key
 *  while the awaited call is still in flight. */
async function withKey<T>(
  value: string | undefined,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prior = process.env.FIRECRAWL_API_KEY;
  if (value === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = value;
  try {
    return await fn();
  } finally {
    if (prior === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = prior;
  }
}

test("only publisher blocks trigger the fallback, not ordinary failures", () => {
  // Amnesty's actual refusal, and its siblings.
  for (const message of [
    "Status code 403",
    "Request failed with status code 401",
    "Too many requests: 429",
    "Forbidden",
    "access denied by origin",
    "blocked by security policy",
  ]) {
    assert.equal(isPublisherBlock(new Error(message)), true, message);
  }
  // A publisher having a bad day must NOT burn a Firecrawl credit.
  for (const message of [
    "fetch failed",
    "Status code 500",
    "connect ETIMEDOUT",
    "Invalid XML",
    "socket hang up",
  ]) {
    assert.equal(isPublisherBlock(new Error(message)), false, message);
  }
});

test("the fallback is inert without a key, so a blocked feed fails honestly", async () => {
  await withKey(undefined, () => {
    assert.equal(firecrawlConfigured(), false);
  });
  await withKey(undefined, async () => {
    await assert.rejects(
      firecrawlRawFetch("https://example.test/feed"),
      /FIRECRAWL_API_KEY is not configured/,
    );
  });
  await withKey("fc-test", () => {
    assert.equal(firecrawlConfigured(), true);
  });
});

test("the fallback returns raw bytes and fails closed on an empty result", async () => {
  await withKey("fc-test", async () => {
    const url = "https://granted-publisher.test/feed";
    assert.equal(
      await firecrawlRawFetch(url, {
        fetchImpl: okFetch,
        permissions: FIXTURE_PERMISSIONS,
      }),
      "<rss>ok</rss>",
    );

    const empty = (async () =>
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
      })) as unknown as typeof fetch;
    await assert.rejects(
      firecrawlRawFetch(url, {
        fetchImpl: empty,
        permissions: FIXTURE_PERMISSIONS,
      }),
      /returned no content/,
    );

    const http500 = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await assert.rejects(
      firecrawlRawFetch(url, {
        fetchImpl: http500,
        permissions: FIXTURE_PERMISSIONS,
      }),
      /HTTP 500/,
    );
  });
});

test("a granted host with a key routes through the fallback", async () => {
  await withKey("fc-test", async () => {
    const decision = publisherFallbackDecision(
      "https://granted-publisher.test/feed",
      FIXTURE_PERMISSIONS,
    );
    assert.equal(decision.allowed, true);
    assert.match(decision.reason, /permission granted/);

    // Subdomains of a granted host inherit the grant.
    for (const url of [
      "https://granted-publisher.test/feed.rss",
      "https://www.granted-publisher.test/feed.rss",
      "https://feeds.granted-publisher.test/feed.rss",
    ]) {
      assert.equal(
        await firecrawlRawFetch(url, {
          fetchImpl: okFetch,
          permissions: FIXTURE_PERMISSIONS,
        }),
        "<rss>ok</rss>",
        url,
      );
    }
  });
});

test("amnesty.org is not permitted, even with a key, and the block stands", async () => {
  // The production registry, not a fixture: this is the owner's decision.
  const decision = publisherFallbackDecision("https://www.amnesty.org/en/rss/");
  assert.equal(decision.allowed, false);
  assert.equal(decision.host, "amnesty.org");
  assert.match(decision.reason, /not_requested/);
  assert.match(decision.reason, /allowlisting/i);
  assert.match(decision.reason, /PUL-040\/amnesty-retrieval-block-2026-08-18/);
  assert.equal(publisherFallbackPermitted("https://www.amnesty.org/en/rss/"), false);

  // A configured key must not change that.
  await withKey("fc-test", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await assert.rejects(
      firecrawlRawFetch("https://www.amnesty.org/en/rss/", { fetchImpl: spy }),
      /not permitted/,
    );
    assert.equal(called, false, "no request may leave for a blocked publisher");
  });

  // Nothing in the shipped registry grants the fallback to anyone yet.
  assert.equal(
    PUBLISHER_FALLBACK_PERMISSIONS.some((entry) => entry.state === "granted"),
    false,
  );
});

test("an unregistered host is not permitted — absence is never consent", async () => {
  for (const url of [
    "https://example.test/feed",
    "https://not-granted-publisher.test/feed",
    "https://grantedpublisher.test/feed",
    "https://granted-publisher.test.evil.test/feed",
  ]) {
    const decision = publisherFallbackDecision(url, FIXTURE_PERMISSIONS);
    assert.equal(decision.allowed, false, url);
    assert.match(decision.reason, /no recorded permission/, url);
  }

  // A lookalike must not inherit a registered host's state, either.
  for (const url of [
    "https://notamnesty.org/feed",
    "https://amnesty.org.evil.test/feed",
  ]) {
    const decision = publisherFallbackDecision(url);
    assert.equal(decision.allowed, false, url);
    assert.match(decision.reason, /no recorded permission/, url);
  }

  await withKey("fc-test", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await assert.rejects(
      firecrawlRawFetch("https://example.test/feed", {
        fetchImpl: spy,
        permissions: FIXTURE_PERMISSIONS,
      }),
      /not permitted/,
    );
    assert.equal(called, false);
  });

  // An input that is not a host at all fails closed too.
  assert.equal(publisherFallbackPermitted("   ", FIXTURE_PERMISSIONS), false);
  assert.equal(publisherFallbackPermitted("nonsense", FIXTURE_PERMISSIONS), false);
});

test("a pending or refused request does not permit the fallback", async () => {
  for (const [url, state] of [
    ["https://pending-publisher.test/feed", "requested_pending"],
    ["https://refused-publisher.test/feed", "denied"],
  ] as const) {
    const decision = publisherFallbackDecision(url, FIXTURE_PERMISSIONS);
    assert.equal(decision.allowed, false, url);
    assert.match(decision.reason, new RegExp(state), url);

    await withKey("fc-test", async () => {
      let called = false;
      const spy = (async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch;
      await assert.rejects(
        firecrawlRawFetch(url, {
          fetchImpl: spy,
          permissions: FIXTURE_PERMISSIONS,
        }),
        /not permitted/,
      );
      assert.equal(called, false, url);
    });
  }
});
