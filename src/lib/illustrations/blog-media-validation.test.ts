import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBlogMedia,
  BLOG_MEDIA_BYTE_BUDGET,
  type BlogMediaFile,
} from "./blog-media-validation";

const ok: BlogMediaFile = {
  path: "public/blog/x/a.webp",
  format: "webp",
  width: 1600,
  height: 900,
  byteSize: 200_000,
  isCover: false,
};

test("a clean webp with readable dims under budget passes", () => {
  assert.deepEqual(validateBlogMedia([ok]), []);
});

test("a portrait webp is fine (aspect is not constrained)", () => {
  assert.deepEqual(
    validateBlogMedia([{ ...ok, width: 1600, height: 2400 }]),
    [],
  );
});

test("a non-webp format is flagged", () => {
  const v = validateBlogMedia([{ ...ok, format: "png" }]);
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "format");
});

test("unreadable dimensions are flagged", () => {
  const v = validateBlogMedia([{ ...ok, width: null, height: null }]);
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "unreadable-dimensions");
});

test("an over-budget source file is flagged", () => {
  const v = validateBlogMedia([
    { ...ok, byteSize: BLOG_MEDIA_BYTE_BUDGET + 1 },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "over-budget");
});
