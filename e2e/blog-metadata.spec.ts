/**
 * EXP-036 — blog metadata & landmarks. Asserts the index and an article each
 * expose exactly one main landmark, and that an article's og:image is the same
 * resolved cover the page uses (not a missing/raw frontmatter value).
 */
import { test, expect } from "./harness/fixtures";

// A post that ships a dedicated public/blog/<slug>/cover.webp.
const ARTICLE_SLUG = "backsliding-without-tanks";

test("the blog index exposes exactly one main landmark", async ({ page, errors }) => {
  await page.goto("/blog");
  await expect(page.getByRole("main")).toHaveCount(1);
  expect(errors.pageErrors).toEqual([]);
});

test("an article exposes exactly one main landmark", async ({ page }) => {
  await page.goto(`/blog/${ARTICLE_SLUG}`);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("an article's og:image is its resolved cover", async ({ page }) => {
  await page.goto(`/blog/${ARTICLE_SLUG}`);
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute("content");
  expect(ogImage, "og:image must be set").toBeTruthy();
  // The resolved cover for this post is its dedicated cover.webp.
  expect(ogImage).toContain(`/blog/${ARTICLE_SLUG}/cover.webp`);
});

test("inline article figures declare width and height (no layout shift)", async ({
  page,
}) => {
  await page.goto(`/blog/${ARTICLE_SLUG}`);
  const figures = page.locator("figure.post-figure img");
  const count = await figures.count();
  // This article renders inline engravings; each must carry intrinsic dims.
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const img = figures.nth(i);
    expect(await img.getAttribute("width"), "img has width").toBeTruthy();
    expect(await img.getAttribute("height"), "img has height").toBeTruthy();
  }
});
