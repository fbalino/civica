/**
 * PLT-001 — bounded, credential-free smoke against `next start` after the
 * canonical offline production build. This deliberately exercises one static
 * reader page and one generated-data API: neither requires Neon, auth, paid
 * models, or any external mutation.
 */
import { expect, test } from "@playwright/test";

test("production server renders a static reader page without runtime failures", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  const response = await page.goto("/privacy", {
    waitUntil: "domcontentloaded",
  });

  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacy Policy" }),
  ).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("Civica Atlas");
  expect(serverErrors).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("production server exposes the DB-independent rights API", async ({
  request,
}) => {
  const response = await request.get("/api/rights-manifest");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");

  const body = (await response.json()) as Record<string, unknown>;
  expect(body.schemaVersion).toBe("rights-manifest/v1");
});
