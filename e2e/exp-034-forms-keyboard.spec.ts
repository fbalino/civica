/**
 * EXP-034 — form-error focus management + keyboard reachability.
 *
 * Complements `scripts/validate-landmarks.ts` (static source check) and the
 * manual live-DOM verification recorded in `plan/evidence/EXP-034/README.md`
 * with an automated, real-browser proof of the two behavioral legs the
 * static checker cannot see:
 *
 *   1. A keyboard user can actually reach the /contact form's controls by
 *      tabbing (no trap).
 *   2. On a failed submit / a server-rendered error reload, the error is
 *      BOTH programmatically announced (role="alert" with real text, and
 *      each invalid control's aria-describedby resolving to real text) AND
 *      focus physically moves to an invalid field or the error summary —
 *      not just associated in markup.
 *
 * Reuses the QA-009 harness (`e2e/harness/fixtures.ts`) against the running
 * dev server on :3000. No new server is started.
 */
import { test, expect } from "./harness/fixtures";

test.describe("EXP-034 — /contact keyboard reachability", () => {
  test("a keyboard user can tab from the first category chip through to the Name field with no trap", async ({
    page,
  }) => {
    await page.goto("/contact");

    const firstChip = page.getByRole("button", { name: "Data correction" });
    await firstChip.focus();
    await expect(firstChip).toBeFocused();

    // Four more chips (Story tip, Partnership, Press, Other) sit between the
    // first chip and the Name field in DOM/tab order; the 5th Tab lands on
    // Name itself.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }

    const nameInput = page.getByLabel("Name");
    await expect(nameInput).toBeFocused();
  });
});

test.describe("EXP-034 — /contact focus-on-error (client validation)", () => {
  test("submitting an empty form announces the error summary and moves focus to the first invalid field", async ({
    page,
    errors,
  }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();

    // (a) the error is announced: a role="alert" summary with real text.
    // Scoped by class, not an unscoped role query — Next.js's own
    // `#__next-route-announcer__` also carries role="alert" on every page.
    const summary = page.locator(".contact-validation-summary");
    await expect(summary).toHaveAttribute("role", "alert");
    await expect(summary).toContainText("Review the highlighted fields");

    // The category group's aria-describedby resolves to a real, non-empty
    // error element (the group is the described unit; the chip button
    // inside it is the first focusable invalid control).
    const group = page.locator('[role="group"][aria-describedby]');
    const describedById = await group.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const describedByEl = page.locator(`#${describedById}`);
    await expect(describedByEl).toHaveText("Pick a category");

    // (b) focus moved to the first invalid field in visual order — the
    // first category chip — not left stranded on the submit button.
    const active = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim(),
    }));
    expect(active.tag).toBe("BUTTON");
    expect(active.text).toBe("Data correction");

    expect(errors.pageErrors).toEqual([]);
  });

  test("when only a later field (Message) is invalid, focus moves there and its error is programmatically associated", async ({
    page,
  }) => {
    await page.goto("/contact");

    await page.getByRole("button", { name: "Story tip" }).click();
    await page.getByLabel("Name").fill("Jane Doe");
    await page.getByLabel("Email").fill("jane@example.com");
    // Message left empty — the only remaining invalid field.
    await page.getByRole("button", { name: "Send message" }).click();

    const messageBox = page.getByLabel("Message");
    await expect(messageBox).toBeFocused();
    await expect(messageBox).toHaveAttribute("aria-invalid", "true");

    const describedById = await messageBox.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    await expect(page.locator(`#${describedById}`)).toHaveText("Required");
  });

  test("a message shorter than 10 characters keeps focus on Message with the length-specific error", async ({
    page,
  }) => {
    await page.goto("/contact");

    await page.getByRole("button", { name: "Press" }).click();
    await page.getByLabel("Name").fill("Jane Doe");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("Message").fill("too short");
    await page.getByRole("button", { name: "Send message" }).click();

    const messageBox = page.getByLabel("Message");
    await expect(messageBox).toBeFocused();
    const describedById = await messageBox.getAttribute("aria-describedby");
    await expect(page.locator(`#${describedById}`)).toHaveText(
      "At least 10 characters",
    );
  });
});

test.describe("EXP-034 — server-rendered sign-in forms move focus to the error on load", () => {
  // Scoped by stable id, not getByRole("alert") — Next.js's own
  // `#__next-route-announcer__` also carries role="alert" (hidden, always
  // present), so an unscoped role query is ambiguous on every page.
  test("/admin/sign-in?error=1 focuses the credential-error alert", async ({
    page,
  }) => {
    await page.goto("/admin/sign-in?error=1");
    const alert = page.locator("#signin-error");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toBeFocused();
    await expect(alert).toContainText("did not match");
  });

  test("/admin/pulse-coding/sign-in?error=1 focuses the access-code error alert", async ({
    page,
  }) => {
    await page.goto("/admin/pulse-coding/sign-in?error=1");
    const alert = page.locator("#coding-signin-error");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toBeFocused();
    await expect(alert).toContainText("invalid, expired, or revoked");
  });
});
