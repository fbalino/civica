import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

const baseUrl =
  process.env.CIVICA_BROWSER_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";
const outputDirectory = resolve(
  process.env.CIVICA_BROWSER_OUTPUT_DIR ?? "output/playwright/EXP-029",
);

const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "mobile", width: 390, height: 844 },
] as const;
const themes = ["light", "dark"] as const;

interface FixtureResult {
  viewport: (typeof viewports)[number]["id"];
  theme: (typeof themes)[number];
  horizontalOverflow: boolean;
  visibleSourceForms: number;
  directions: Record<string, string>;
  screenshot: string;
}

async function setTheme(page: Page, theme: (typeof themes)[number]) {
  await page.evaluate((selectedTheme) => {
    window.localStorage.setItem("theme", selectedTheme);
    document.documentElement.setAttribute("data-theme", selectedTheme);
  }, theme);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    headless: process.env.CIVICA_BROWSER_HEADED !== "1",
  });
  const results: FixtureResult[] = [];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      for (const theme of themes) {
        await page.goto(`${baseUrl}/design-system`, {
          waitUntil: "networkidle",
        });
        await setTheme(page, theme);
        const fixtureHeading = page.getByRole("heading", {
          name: "Source-form text and bidirectional stress fixture",
        });
        await fixtureHeading.scrollIntoViewIfNeeded();
        const fixturePanel = fixtureHeading.locator("..");

        const fixture = page.locator(".source-text");
        const visibleSourceForms = await fixture.count();
        if (visibleSourceForms < 4) {
          throw new Error(
            `Expected four source-form fixtures, found ${visibleSourceForms}`,
          );
        }

        const directions = await fixture
          .locator("bdi")
          .evaluateAll((nodes) =>
            Object.fromEntries(
              nodes.map((node) => [
                node.getAttribute("lang") ?? "unknown",
                getComputedStyle(node).direction,
              ]),
            ),
          );
        if (directions.ar !== "rtl" || directions.he !== "rtl") {
          throw new Error(
            `RTL direction failed: ${JSON.stringify(directions)}`,
          );
        }
        if (directions.ja !== "ltr" || directions["es-UY"] !== "ltr") {
          throw new Error(
            `LTR direction failed: ${JSON.stringify(directions)}`,
          );
        }

        const horizontalOverflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        if (horizontalOverflow) {
          throw new Error(
            `${viewport.id}/${theme} has horizontal page overflow`,
          );
        }

        const screenshot = resolve(
          outputDirectory,
          `design-system-${viewport.id}-${theme}.png`,
        );
        await fixturePanel.screenshot({ path: screenshot });
        results.push({
          viewport: viewport.id,
          theme,
          horizontalOverflow,
          visibleSourceForms,
          directions,
          screenshot,
        });
      }
      await context.close();
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/about#language`, { waitUntil: "networkidle" });
    const languageHeading = page.getByRole("heading", {
      name: "Language scope",
    });
    await languageHeading.scrollIntoViewIfNeeded();
    if (!(await languageHeading.isVisible())) {
      throw new Error("The public Language scope section is not visible");
    }
    const disclosure = await languageHeading
      .locator("xpath=following-sibling::*[1]")
      .textContent();
    if (
      !disclosure?.includes("English interface") ||
      !disclosure.includes("does not currently offer a translated interface")
    ) {
      throw new Error("The rendered public language disclosure is incomplete");
    }
    await languageHeading.locator("..").screenshot({
      path: resolve(outputDirectory, "about-language-scope.png"),
    });
    await context.close();
  } finally {
    await browser.close();
  }

  const evidence = {
    contract: "exp-029-browser-verification/v1",
    checkedAt: new Date().toISOString(),
    baseUrl,
    results,
  };
  const evidencePath = resolve(outputDirectory, "browser-verification.json");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(
    `PASS — ${results.length} multilingual viewport/theme fixtures and the public language disclosure rendered correctly.`,
  );
  console.log(evidencePath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
