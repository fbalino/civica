/** EXP-024 — named document layers and real collision behaviour. */
import {
  test,
  expect,
  VIEWPORTS,
  waitForReactHydration,
} from "./harness/fixtures";
import type { Page } from "@playwright/test";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;

const EXPECTED_LAYERS = {
  "--z-sticky": "20",
  "--z-popover": "40",
  "--z-tooltip": "50",
  "--z-overlay-backdrop": "60",
  "--z-overlay": "70",
  "--z-modal-backdrop": "90",
  "--z-modal": "100",
  "--z-toast": "200",
} as const;

async function expectDialogCoversHeader(
  page: Page,
  dialogName: string,
) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("z-index", EXPECTED_LAYERS["--z-modal"]);

  const dialogOwnsHeaderPoint = await dialog.evaluate((element) => {
    const point = document.elementFromPoint(16, 16);
    return point !== null && (point === element || element.contains(point));
  });
  expect(dialogOwnsHeaderPoint).toBe(true);
}

test.describe("EXP-024 — layer contract", () => {
  test("desktop navigation, selects, and source tooltips use their named layers", async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/design-system", { waitUntil: "networkidle" });
    const layerReference = page.getByRole("list", { name: "Document layer order" });
    await expect(layerReference).toBeVisible();
    await expect(layerReference.getByText("--z-modal", { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 800));
    const stickyOffsets = await page.evaluate(() => {
      const siteHeader = document.querySelector("#site-header");
      const systemHeader = document.querySelector(".ds-top");
      if (!(siteHeader instanceof HTMLElement) || !(systemHeader instanceof HTMLElement)) {
        throw new Error("missing sticky header");
      }
      return {
        siteHeaderBottom: siteHeader.getBoundingClientRect().bottom,
        systemHeaderTop: systemHeader.getBoundingClientRect().top,
      };
    });
    expect(stickyOffsets.systemHeaderTop).toBeGreaterThanOrEqual(
      stickyOffsets.siteHeaderBottom - 1,
    );

    await page.goto("/", { waitUntil: "networkidle" });

    const rootLayers = await page.evaluate((tokens) =>
      Object.fromEntries(
        tokens.map((token) => [
          token,
          getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
        ]),
      ),
      Object.keys(EXPECTED_LAYERS),
    );
    expect(rootLayers).toEqual(EXPECTED_LAYERS);

    const explore = page.getByRole("button", { name: "Explore" });
    await waitForReactHydration(explore);
    await explore.click();
    const menu = page.locator(".explore-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("z-index", EXPECTED_LAYERS["--z-popover"]);
    await expect(page.locator("#site-header")).toHaveCSS(
      "z-index",
      EXPECTED_LAYERS["--z-sticky"],
    );

    await page.goto("/parties", { waitUntil: "networkidle" });
    const select = page.getByRole("button", { name: "Filter by region" });
    await waitForReactHydration(select);
    await select.click();
    await expect(page.getByRole("listbox", { name: "Filter by region" })).toHaveCSS(
      "z-index",
      EXPECTED_LAYERS["--z-popover"],
    );

    await page.goto("/country/switzerland", { waitUntil: "networkidle" });
    const sourceDot = page.locator('.source-dot[role="img"]').first();
    await sourceDot.focus();
    await expect(sourceDot).toHaveCSS("outline-style", "solid");
    const tooltipLayer = await sourceDot.evaluate((element) =>
      getComputedStyle(element, "::after").zIndex,
    );
    expect(tooltipLayer).toBe(EXPECTED_LAYERS["--z-tooltip"]);
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("map dialog and lightbox cover sticky document chrome at desktop", async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/country/switzerland", { waitUntil: "networkidle" });

    const mapTrigger = page.getByRole("button", {
      name: "Explore the interactive map of Switzerland",
    });
    await waitForReactHydration(mapTrigger);
    await mapTrigger.click();
    await expectDialogCoversHeader(page, "Map of Switzerland");
    await page.getByRole("button", { name: "Close map" }).click();
    await expect(page.getByRole("dialog", { name: "Map of Switzerland" })).toHaveCount(0);

    const photoTrigger = page.getByRole("button", { name: /Open \d+ photos/ });
    await waitForReactHydration(photoTrigger);
    await photoTrigger.click();
    await expectDialogCoversHeader(page, "Photo gallery");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog", { name: "Photo gallery" })).toHaveCount(0);
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("mobile navigation modal covers the sticky header and still closes", async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto("/", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", { name: "Open menu" });
    await waitForReactHydration(trigger);
    await trigger.click();
    await expectDialogCoversHeader(page, "Main menu");
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("dialog", { name: "Main menu" })).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});
