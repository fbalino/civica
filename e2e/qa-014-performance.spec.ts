/** QA-014 / EXP-026 — production reader performance and payload budgets. */
import type { Response } from "@playwright/test";

import {
  READER_PERFORMANCE_FIXTURES,
  readerPerformanceBudgetErrors,
} from "../src/lib/qa/reader-performance-budget";
import { expect, test } from "./harness/fixtures";
import {
  collectReaderPerformanceMetrics,
  installReaderPerformanceObservers,
} from "./harness/performance";

test.describe("QA-014 — reader performance budgets", () => {
  test.describe.configure({ mode: "serial" });

  for (const fixture of READER_PERFORMANCE_FIXTURES) {
    test(`${fixture.id} stays within its payload and interaction budget`, async ({
      page,
    }, testInfo) => {
      test.skip(
        fixture.requiresFixtureDatabase &&
          process.env.E2E_PERFORMANCE_FIXTURE_DB !== "1",
        "This representative route needs the controlled read-only fixture database.",
      );
      const responses: Response[] = [];
      page.on("response", (response) => responses.push(response));
      await page.setViewportSize({ width: 1280, height: 900 });
      await installReaderPerformanceObservers(page);

      const navigation = await page.goto(fixture.path, {
        waitUntil: "domcontentloaded",
      });
      expect(navigation?.status()).toBeLessThan(400);
      const ready = page.locator(fixture.readySelector).first();
      await expect(ready).toBeVisible();
      const mapInitializationMs = fixture.budget.mapInitializationMs
        ? await page.evaluate(() => performance.now())
        : null;

      if (fixture.interaction === "explore-menu") {
        const trigger = page.getByRole("button", {
          name: "Explore",
          exact: true,
        });
        await trigger.click();
        await page.keyboard.press("Escape");
      } else if (fixture.interaction === "atlas-controls") {
        await page.locator(".atlas-country-controls summary").click();
      } else {
        // The shared header disclosure is present on every reader route and
        // gives the Event Timing observer a real keyboard-operable reader
        // interaction rather than a synthetic programmatic event.
        const trigger = page.getByRole("button", {
          name: "Explore",
          exact: true,
        });
        await trigger.click();
        await page.keyboard.press("Escape");
      }
      // Event Timing observers report asynchronously after a paint.
      await page.waitForTimeout(300);

      const metrics = await collectReaderPerformanceMetrics(
        page,
        responses,
        mapInitializationMs,
      );
      await testInfo.attach(`${fixture.id}-performance.json`, {
        body: JSON.stringify(
          {
            contract: "civica-reader-performance-budget/v1",
            fixture: fixture.id,
            path: fixture.path,
            metrics,
            budget: fixture.budget,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });

      const errors = readerPerformanceBudgetErrors(fixture, metrics);
      expect(errors, `${fixture.id} performance budget failures`).toEqual([]);
    });
  }
});
