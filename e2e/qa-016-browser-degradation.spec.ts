/** QA-016 — supported browsers and documented reader degradation paths. */
import { expect, test } from "./harness/fixtures";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

function requireControlledFixtureDatabase(projectName: string): void {
  test.skip(
    projectName !== "chromium",
    "Controlled failure fixtures run once in Chromium; all support profiles run critical reader journeys.",
  );
  test.skip(
    process.env.E2E_PERFORMANCE_FIXTURE_DB !== "1",
    "This controlled reader fixture needs the read-only database environment.",
  );
}

test.describe("QA-016 — supported browsers and graceful degradation", () => {
  test("critical reader journey renders and navigation stays operable", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible();

    const explore = page.getByRole("button", { name: "Explore", exact: true });
    await explore.click();
    await expect(page.locator('.explore-menu a[href="/country"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(explore).toHaveAttribute("aria-expanded", "false");

    await page.goto("/accessibility", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Reader journeys and graceful fallback." }),
    ).toBeVisible();

    await page.goto("/blog/governing-the-very-small", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("reader content remains visible when JavaScript is disabled", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1").first()).toBeVisible();
      await page.goto(`${BASE_URL}/blog/governing-the-very-small`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("Atlas retains local geometry and a table alternative when the CDN fails", async ({
    page,
  }, testInfo) => {
    requireControlledFixtureDatabase(testInfo.project.name);
    let blocked = 0;
    await page.route(/https:\/\/unpkg\.com\//, async (route) => {
      blocked += 1;
      await route.abort("failed");
    });
    await page.goto("/atlas", { waitUntil: "domcontentloaded" });
    await expect.poll(() => blocked).toBeGreaterThan(0);
    await expect(page.locator(".world-map path[data-id]").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Map layer table alternative" }),
    ).toBeVisible();
  });

  test("country map failure exposes a visible status instead of a blank canvas", async ({
    page,
  }, testInfo) => {
    requireControlledFixtureDatabase(testInfo.project.name);
    await page.addInitScript(() => {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: () => null,
      });
    });
    await page.goto("/country/switzerland", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".country-map-unavailable").first()).toBeVisible();
    await expect(page.locator(".country-map-activation")).toBeVisible();
  });

  test("failed leader portraits retain the named monogram fallback", async ({
    page,
  }, testInfo) => {
    requireControlledFixtureDatabase(testInfo.project.name);
    let blocked = 0;
    await page.route("**://commons.wikimedia.org/**", async (route) => {
      blocked += 1;
      await route.abort("failed");
    });
    await page.goto("/country/switzerland/civica-data", {
      waitUntil: "domcontentloaded",
    });
    const portrait = page.locator(".lead-avatar-photo").first();
    await expect(portrait).toBeVisible();
    await portrait.scrollIntoViewIfNeeded();
    await expect.poll(() => blocked).toBeGreaterThan(0);
    await expect(page.locator(".lead-avatar-monogram").first()).toBeVisible();
  });

  test("Ask Civica provider failure keeps the reader in a safe local state", async ({
    page,
  }, testInfo) => {
    requireControlledFixtureDatabase(testInfo.project.name);
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "text/plain; charset=utf-8",
        body: "Ask Civica is temporarily unavailable. Please try again shortly.",
      });
    });
    await page.goto("/country/switzerland/civica-data", {
      waitUntil: "domcontentloaded",
    });
    const prompt = page.getByRole("textbox", {
      name: /Ask anything about Switzerland/,
    });
    await prompt.fill("What is the government structure?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByText("Sorry — chat is unavailable right now."),
    ).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });
});
