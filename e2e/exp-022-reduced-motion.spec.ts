/** EXP-022 — reduced-motion behavior across editorial, map, menu, and dialogs. */
import {
  test,
  expect,
  waitForReactHydration,
} from "./harness/fixtures";
import type { Locator, Page } from "@playwright/test";

async function preferReducedMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
}

async function transitionDuration(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).transitionDuration);
}

test.describe("EXP-022 — reduced motion", () => {
  test("editorial hero stays static and the Explore menu remains fully usable", async ({
    page,
    errors,
  }) => {
    await preferReducedMotion(page);
    await page.goto("/", { waitUntil: "networkidle" });

    const title = page.getByRole("heading", { name: "Civica Atlas" });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS("opacity", "1");
    await expect(title).toHaveCSS("transform", "none");
    await expect(page.locator(".home-hero-art-img").first()).toHaveCSS(
      "transform",
      "none",
    );

    const trigger = page.getByRole("button", { name: "Explore" });
    await waitForReactHydration(trigger);
    await trigger.click();
    const menu = page.getByLabel("Explore Civica Atlas");
    await expect(menu).toBeVisible();
    expect(await transitionDuration(menu)).toBe("0s");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("atlas selection completes without an in-progress flight", async ({
    page,
    errors,
  }) => {
    await preferReducedMotion(page);
    await page.goto("/atlas", { waitUntil: "networkidle" });

    const controls = page.locator(".atlas-country-controls");
    await controls.locator("summary").press("Enter");
    const selector = page.getByRole("combobox", { name: "Select a country" });
    await waitForReactHydration(selector);

    const content = page.locator("#mapContent");
    const initialTransform = await content.getAttribute("transform");
    await selector.selectOption("fra");
    await expect.poll(() => content.getAttribute("transform")).not.toBe(initialTransform);
    const settledTransform = await content.getAttribute("transform");

    await page.waitForTimeout(750);
    await expect(content).toHaveAttribute("transform", settledTransform ?? "");
    expect(await transitionDuration(page.locator('path[data-id="fra"]').first())).toBe("0s");
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("map dialog opens and closes with no motion while preserving focus", async ({
    page,
    errors,
  }) => {
    await preferReducedMotion(page);
    await page.goto("/country/switzerland", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", {
      name: "Explore the interactive map of Switzerland",
    });
    await waitForReactHydration(trigger);
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Map of Switzerland" });
    await expect(dialog).toBeVisible();
    expect(await transitionDuration(dialog)).toBe("0s");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});
