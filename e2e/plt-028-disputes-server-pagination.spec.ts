/** PLT-028 — public dispute controls query the server instead of a client feed. */
import { expect, test, waitForReactHydration } from "./harness/fixtures";
import { DISPUTES_RESPONSE_BUDGET_BYTES } from "@/app/(reader)/country/methodology/reconciliation/disputes/query";

test("Public disputes keep filters and sort state in the server-query URL", async ({
  page,
  errors,
}) => {
  const response = await page.goto("/country/methodology/reconciliation/disputes", {
    waitUntil: "domcontentloaded",
  });
  expect(response).not.toBeNull();
  expect((await response!.body()).byteLength).toBeLessThanOrEqual(
    DISPUTES_RESPONSE_BUDGET_BYTES,
  );

  const resolved = page.getByRole("tab", { name: "Resolved", exact: true });
  await waitForReactHydration(resolved);
  await resolved.click();
  await expect(page).toHaveURL(
    /\/country\/methodology\/reconciliation\/disputes\?status=resolved$/,
  );

  await page.getByRole("button", { name: "Sort disputes" }).click();
  await page.getByRole("option", { name: "Oldest" }).click();
  await expect(page).toHaveURL(
    /\?status=resolved&sort=oldest$/,
  );

  expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
});
