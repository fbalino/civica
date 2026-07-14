import assert from "node:assert/strict";
import test from "node:test";

import { immutableArtifactResponse } from "./artifact-response";

test("immutable artifacts preserve exact bytes and download headers", async () => {
  const bytes = Uint8Array.from([0x1f, 0x8b, 0x08]);
  const response = await immutableArtifactResponse({
    operation: "fixture",
    filename: "release.json.gz",
    contentType: "application/gzip",
    load: async () => bytes,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/gzip");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="release.json.gz"',
  );
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("filesystem errors become one safe non-cacheable problem", async () => {
  const previous = console.error;
  console.error = () => undefined;
  try {
    const response = await immutableArtifactResponse({
      operation: "fixture",
      filename: "release.json",
      contentType: "application/json; charset=utf-8",
      load: async () => {
        throw new Error(
          "ENOENT /private/build/path postgres://owner:secret@example.test/db",
        );
      },
    });

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.deepEqual(body, {
      error: "The requested artifact is temporarily unavailable.",
      code: "ARTIFACT_UNAVAILABLE",
    });
    assert.doesNotMatch(JSON.stringify(body), /private|postgres|secret|ENOENT/);
  } finally {
    console.error = previous;
  }
});
