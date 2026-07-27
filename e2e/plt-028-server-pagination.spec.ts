/** PLT-028 — reader Pulse changelog keeps filters and pagination in the URL. */
import { expect, test, waitForReactHydration } from "./harness/fixtures";
import { PULSE_CHANGELOG_RESPONSE_BUDGET_BYTES } from "@/app/(reader)/civica-index/pulse-changelog/query";

test("Pulse changelog changes its server-query URL instead of client filtering a full feed", async ({
  page,
  errors,
}) => {
  const response = await page.goto("/civica-index/pulse-changelog?page=2", {
    waitUntil: "domcontentloaded",
  });
  expect(response).not.toBeNull();
  expect((await response!.body()).byteLength).toBeLessThanOrEqual(
    PULSE_CHANGELOG_RESPONSE_BUDGET_BYTES,
  );

  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  const previous = page.getByRole("button", { name: "← Page 1" });
  await waitForReactHydration(previous);
  await previous.click();
  await expect(page).toHaveURL(/\/civica-index\/pulse-changelog$/);

  await page.getByRole("button", { name: "Rule of Law" }).click();
  await expect(page).toHaveURL(/\?dimension=rule_of_law$/);

  await page.getByRole("button", { name: "Show review outcomes" }).click();
  await expect(page).toHaveURL(
    /\?dimension=rule_of_law&review=1$/,
  );

  expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
});
