import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBlogSocialImage,
  getPostBySlug,
  type BlogPost,
} from "./blog";

function fixturePost(overrides: Partial<BlogPost>): BlogPost {
  return {
    slug: "zz-social-image-fixture",
    title: "Fixture Title",
    date: "2026-01-01",
    author: "Fixture Author",
    description: "desc",
    tags: [],
    coverImage: null,
    coverAlt: null,
    coverCaption: null,
    draft: false,
    content: "No placeholder here.",
    ...overrides,
  };
}

test("dedicated cover: resolves a real post's cover.webp to an absolute URL", () => {
  // backsliding-without-tanks ships a dedicated public/blog/<slug>/cover.webp.
  const post = getPostBySlug("backsliding-without-tanks");
  assert.ok(post, "expected the fixture blog post to exist");
  const social = resolveBlogSocialImage(post);
  assert.ok(social, "expected a resolved social image");
  assert.match(
    social.url,
    /^https:\/\/civicaatlas\.org\/blog\/backsliding-without-tanks\/cover\.webp$/,
  );
  assert.ok(social.alt.length > 0);
});

test("frontmatter fallback: coverImage becomes an absolute URL with its alt", () => {
  const social = resolveBlogSocialImage(
    fixturePost({
      coverImage: "/blog/somewhere/cover.webp",
      coverAlt: "A described cover",
    }),
  );
  assert.deepEqual(social, {
    url: "https://civicaatlas.org/blog/somewhere/cover.webp",
    alt: "A described cover",
  });
});

test("no resolvable cover: returns null (page uses the generated HemicycleCover)", () => {
  const social = resolveBlogSocialImage(
    fixturePost({ coverImage: null, content: "Body with no image placeholder." }),
  );
  assert.equal(social, null);
});

test("alt falls back to the post title when no coverAlt/caption exists", () => {
  const social = resolveBlogSocialImage(
    fixturePost({ coverImage: "/blog/x/cover.webp", title: "My Post" }),
  );
  assert.equal(social?.alt, "My Post");
});
