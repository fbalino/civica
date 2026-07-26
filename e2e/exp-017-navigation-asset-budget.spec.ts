/** EXP-017 — navigation and hero asset transfer budget. */
import type { Response } from "@playwright/test";

import { EXPLORE_NAV_GROUPS } from "../src/components/exploreNavItems";
import { expect, test } from "./harness/fixtures";

const NAVIGATION_ART_PREFIX = "/engravings/navigation/explore-";
const MAX_OPEN_MENU_ART_BYTES = 96_000;

const NAVIGATION_ART_NAMES = Array.from(
  new Set(
    EXPLORE_NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => item.art),
    ),
  ),
).sort();

function localPath(url: string): string {
  return new URL(url).pathname;
}

function navigationArtPaths(responses: readonly Response[]): string[] {
  return responses
    .filter((response) => response.request().resourceType() === "image")
    .map((response) => localPath(response.url()))
    .filter((path) => path.startsWith(NAVIGATION_ART_PREFIX));
}

function expectedNavigationArtPaths(theme: "light" | "dark"): string[] {
  return NAVIGATION_ART_NAMES.map(
    (art) =>
      `${NAVIGATION_ART_PREFIX}${art}${theme === "dark" ? "-dark" : ""}.webp`,
  );
}

async function openExploreMenu(page: import("@playwright/test").Page) {
  const trigger = page.getByRole("button", { name: "Explore", exact: true });
  await trigger.click();
  await expect(page.locator('.explore-menu a[href="/country"]')).toBeVisible();
}

test.describe("EXP-017 — navigation and hero asset budget", () => {
  test("closed desktop Explore menu defers its art, then loads only the light destination batch", async ({
    page,
  }) => {
    const responses: Response[] = [];
    page.on("response", (response) => responses.push(response));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/about", { waitUntil: "networkidle" });

    expect(navigationArtPaths(responses)).toEqual([]);

    await openExploreMenu(page);
    await expect
      .poll(() => navigationArtPaths(responses).length)
      .toBe(NAVIGATION_ART_NAMES.length);

    const artResponses = responses.filter((response) =>
      localPath(response.url()).startsWith(NAVIGATION_ART_PREFIX),
    );
    expect(navigationArtPaths(responses).sort()).toEqual(
      expectedNavigationArtPaths("light"),
    );
    expect(
      navigationArtPaths(responses).some((path) => path.includes("-dark.webp")),
    ).toBe(false);

    const totalBytes = (
      await Promise.all(artResponses.map((response) => response.body()))
    ).reduce((sum, body) => sum + body.byteLength, 0);
    expect(totalBytes).toBeLessThanOrEqual(MAX_OPEN_MENU_ART_BYTES);
  });

  test("dark mode resolves dark menu and homepage art without light counterparts", async ({
    page,
  }) => {
    const menuResponses: Response[] = [];
    page.on("response", (response) => menuResponses.push(response));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark");
    });
    await page.goto("/about", { waitUntil: "networkidle" });
    await openExploreMenu(page);
    await expect
      .poll(() => navigationArtPaths(menuResponses).length)
      .toBe(NAVIGATION_ART_NAMES.length);

    expect(navigationArtPaths(menuResponses).sort()).toEqual(
      expectedNavigationArtPaths("dark"),
    );

    const homeResponses: Response[] = [];
    page.on("response", (response) => homeResponses.push(response));
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".home-hero-art-img.civica-themed-image")).toBeVisible();

    const heroPaths = homeResponses
      .filter((response) => response.request().resourceType() === "image")
      .map((response) => localPath(response.url()))
      .filter((path) => path.includes("/engravings/hero"));
    expect(heroPaths).toContain("/engravings/hero-dark.webp");
    expect(heroPaths).not.toContain("/engravings/hero.webp");
  });

  test("closed mobile menu defers its destination artwork", async ({ page }) => {
    const responses: Response[] = [];
    page.on("response", (response) => responses.push(response));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/about", { waitUntil: "networkidle" });
    expect(navigationArtPaths(responses)).toEqual([]);

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator(".mobile-menu")).toBeVisible();
    await expect
      .poll(() => navigationArtPaths(responses).length)
      .toBe(NAVIGATION_ART_NAMES.length);

    const artResponses = responses.filter((response) =>
      localPath(response.url()).startsWith(NAVIGATION_ART_PREFIX),
    );
    expect(navigationArtPaths(responses).sort()).toEqual(
      expectedNavigationArtPaths("light"),
    );
    const totalBytes = (
      await Promise.all(artResponses.map((response) => response.body()))
    ).reduce((sum, body) => sum + body.byteLength, 0);
    expect(totalBytes).toBeLessThanOrEqual(MAX_OPEN_MENU_ART_BYTES);
  });
});
