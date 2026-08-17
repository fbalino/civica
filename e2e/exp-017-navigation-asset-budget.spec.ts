/**
 * EXP-017 — navigation and hero asset transfer budget.
 *
 * The Explore menu is a plain text dropdown (owner decision 2026-08-17): no
 * navigation artwork may be requested on any surface, open or closed. The
 * hero check still proves the homepage resolves only the active theme's art.
 */
import type { Response } from "@playwright/test";

import { expect, test } from "./harness/fixtures";

const NAVIGATION_ART_PREFIX = "/engravings/navigation/explore-";

function localPath(url: string): string {
  return new URL(url).pathname;
}

function navigationArtPaths(responses: readonly Response[]): string[] {
  return responses
    .filter((response) => response.request().resourceType() === "image")
    .map((response) => localPath(response.url()))
    .filter((path) => path.startsWith(NAVIGATION_ART_PREFIX));
}

async function openExploreMenu(page: import("@playwright/test").Page) {
  const trigger = page.getByRole("button", { name: "Explore", exact: true });
  await trigger.click();
  await expect(page.locator('.explore-menu a[href="/country"]')).toBeVisible();
}

test.describe("EXP-017 — navigation and hero asset budget", () => {
  test("the desktop Explore dropdown loads no navigation artwork, closed or open", async ({
    page,
  }) => {
    const responses: Response[] = [];
    page.on("response", (response) => responses.push(response));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/about", { waitUntil: "networkidle" });

    expect(navigationArtPaths(responses)).toEqual([]);

    await openExploreMenu(page);
    await page.waitForTimeout(250);
    expect(navigationArtPaths(responses)).toEqual([]);
  });

  test("dark mode resolves dark homepage hero art without light counterparts", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark");
    });

    const homeResponses: Response[] = [];
    page.on("response", (response) => homeResponses.push(response));
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(
      page.locator(".home-hero-art-img.civica-themed-image"),
    ).toBeVisible();

    const heroPaths = homeResponses
      .filter((response) => response.request().resourceType() === "image")
      .map((response) => localPath(response.url()))
      .filter((path) => path.includes("/engravings/hero"));
    expect(heroPaths).toContain("/engravings/hero-dark.webp");
    expect(heroPaths).not.toContain("/engravings/hero.webp");
  });

  test("the open mobile menu loads no navigation artwork", async ({ page }) => {
    const responses: Response[] = [];
    page.on("response", (response) => responses.push(response));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about", { waitUntil: "networkidle" });
    expect(navigationArtPaths(responses)).toEqual([]);

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator(".mobile-menu")).toBeVisible();
    await page.waitForTimeout(250);
    expect(navigationArtPaths(responses)).toEqual([]);
  });
});
