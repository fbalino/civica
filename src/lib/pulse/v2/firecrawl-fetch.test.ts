import assert from "node:assert/strict";
import test from "node:test";

import {
  firecrawlConfigured,
  firecrawlRawFetch,
  isPublisherBlock,
} from "./firecrawl-fetch";

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
    const ok = (async () =>
      new Response(
        JSON.stringify({ success: true, data: { rawHtml: "<rss>ok</rss>" } }),
        { status: 200 },
      )) as unknown as typeof fetch;
    assert.equal(
      await firecrawlRawFetch("https://example.test/feed", { fetchImpl: ok }),
      "<rss>ok</rss>",
    );

    const empty = (async () =>
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
      })) as unknown as typeof fetch;
    await assert.rejects(
      firecrawlRawFetch("https://example.test/feed", { fetchImpl: empty }),
      /returned no content/,
    );

    const http500 = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await assert.rejects(
      firecrawlRawFetch("https://example.test/feed", { fetchImpl: http500 }),
      /HTTP 500/,
    );
  });
});
