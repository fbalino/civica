import assert from "node:assert/strict";
import test from "node:test";

import {
  responseWithCacheProfile,
  withResponseCacheProfile,
} from "./response-cache";

test("final response cache boundary fills omissions and overwrites contradictions", async () => {
  const missing = responseWithCacheProfile(
    Response.json({ ok: true }, { status: 201 }),
    "public-live",
  );
  assert.equal(missing.headers.get("Cache-Control"), "no-store");

  const contradictory = await withResponseCacheProfile(
    "private-live",
    () =>
      Response.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "X-Civica-Test": "preserved",
          },
        },
      ),
  );
  assert.equal(
    contradictory.headers.get("Cache-Control"),
    "private, no-store",
  );
  assert.equal(contradictory.headers.get("X-Civica-Test"), "preserved");
  assert.deepEqual(await contradictory.json(), { ok: true });
});

test("final response cache boundary preserves redirects and cookies", () => {
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: "https://example.test/next",
      "Set-Cookie": "session=cleared; Path=/; HttpOnly",
    },
  });
  const sealed = responseWithCacheProfile(response, "private-live");
  assert.equal(sealed.status, 303);
  assert.equal(sealed.headers.get("Location"), "https://example.test/next");
  assert.equal(
    sealed.headers.get("Set-Cookie"),
    "session=cleared; Path=/; HttpOnly",
  );
  assert.equal(sealed.headers.get("Cache-Control"), "private, no-store");
});
