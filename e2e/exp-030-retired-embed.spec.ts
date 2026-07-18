/** EXP-030/031 — retired embeds remain semantic and contain no published data fields. */
import { test, expect } from "@playwright/test";
import { RIGHTS_REGISTRY_URL } from "@/lib/claims/reuse-rights";

const LEGACY_PRESETS = [
  { name: "small", width: 320, height: 240 },
  { name: "medium", width: 480, height: 320 },
  { name: "large", width: 640, height: 420 },
  { name: "custom", width: 360, height: 320 },
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const preset of LEGACY_PRESETS) {
    test(`retired ${preset.name} embed is a complete semantic document in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: preset.width, height: preset.height });
      const response = await page.goto(
        `/embed/brazil?size=${preset.name}&theme=${theme}&w=${preset.width}&h=${preset.height}&include=ci,cp,capital`,
        { waitUntil: "domcontentloaded" },
      );

      expect(response?.status()).toBe(410);
      expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
      await expect(page).toHaveTitle("Civica Index embed retired");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(page.locator('meta[name="civica:rights"]')).toHaveAttribute(
        "content",
        RIGHTS_REGISTRY_URL,
      );

      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(
        "Civica Index embed retired",
      );
      await expect(main).toContainText("without a composite country score or rank");
      await expect(main).not.toContainText(/Pulse|taxonomy|dimension/i);
      await expect(
        main.getByRole("link", { name: "Open Governance Evidence" }),
      ).toHaveAttribute("target", "_top");
      await expect(main.getByRole("link", { name: "Rights and reuse" })).toHaveAttribute(
        "target",
        "_top",
      );
      await expect(page.locator("table, dl, ul, ol, style, script")).toHaveCount(0);

      const dimensions = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        height: window.innerHeight,
        width: window.innerWidth,
      }));
      expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    });
  }
}
