/**
 * QA-010 — critical reader journeys, part 2: content surfaces.
 *
 * elections, organizations, the Record (blog), methodology/citation, and API
 * docs. Runs under the QA-009 harness:
 * `npm run test:e2e -- qa-010-reader-journeys`.
 *
 * Read-only throughout: no form submissions, no mutations, no paid model
 * calls.
 */
import { test, expect } from "./harness/fixtures";

test.describe("elections (QA-010)", () => {
  test("elections index and electoral-systems explainer render", async ({
    page,
    errors,
  }) => {
    await page.goto("/elections");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "National election records, audited row by row.",
      }),
    ).toBeVisible();

    await page.goto("/elections/systems");
    await expect(
      page.getByRole("heading", { level: 1, name: "How electoral systems work." }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("organizations (QA-010)", () => {
  test("organizations index redirects to a real org, and ECOWAS detail renders members", async ({
    page,
    errors,
  }) => {
    const res = await page.goto("/organizations");
    expect(res?.status(), "org index responds < 400 after redirect").toBeLessThan(400);
    await expect(page).toHaveURL(/\/organizations\/[a-z-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/organizations/ecowas");
    await expect(page.getByRole("heading", { level: 1, name: "ECOWAS" })).toBeVisible();
    expect(await page.locator(".intl-mem-row").count()).toBeGreaterThan(0);

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("the Record / blog (QA-010)", () => {
  test("blog index and a real article render", async ({ page, errors }) => {
    await page.goto("/blog");
    await expect(page.locator(".record-nameplate")).toContainText("The Record");
    // At least one article card links into /blog/<slug>.
    expect(await page.locator('a[href^="/blog/"]').count()).toBeGreaterThan(0);

    await page.goto("/blog/welcome-to-civica");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Welcome to Civica: A New Atlas of World Governance",
      }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("methodology + citation (QA-010)", () => {
  test("the methodology page's Cite This Page accordion expands with real citation formats", async ({
    page,
    errors,
  }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1, name: "Methodology" })).toBeVisible();

    const trigger = page.locator("summary.cite-accordion-summary");
    await expect(trigger).toContainText("Cite this page");
    await trigger.click();

    const formats = page.getByRole("tablist").filter({ hasText: "APA" });
    await expect(formats).toBeVisible();
    await expect(formats.getByRole("tab", { name: "APA" })).toBeVisible();
    await expect(formats.getByRole("tab", { name: "BibTeX" })).toBeVisible();
    await expect(page.locator("pre.cite-text")).not.toBeEmpty();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("API docs (QA-010)", () => {
  test("the API docs page renders endpoint sections", async ({ page, errors }) => {
    await page.goto("/api-docs");
    await expect(page.getByRole("heading", { level: 1, name: "Public API" })).toBeVisible();
    await expect(
      page.locator("#endpoints").getByRole("heading", { level: 2, name: "Endpoints" }),
    ).toBeVisible();
    expect(
      await page.locator("#endpoints .api-endpoint-path").count(),
    ).toBeGreaterThan(0);

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});
