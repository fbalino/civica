/**
 * QA-009 — shared harness fixtures for the Civica Playwright suite.
 *
 * Exposes:
 *   - `test` / `expect` extended with an `errors` fixture that captures
 *     console errors, uncaught page errors, failed requests, and >=400
 *     responses for the whole test.
 *   - `VIEWPORTS` / `THEMES` — the declared responsive + theme matrix.
 *   - `setTheme(page, theme)` — emulate prefers-color-scheme AND stamp
 *     `data-theme` (the app honours both).
 *   - `loginAsAdmin(page)` — form login using an env-supplied test
 *     password; returns false (so callers skip) when creds are absent, so
 *     the harness never depends on committing a secret.
 */
import { test as base, expect, type Page } from "@playwright/test";

export type ViewportSpec = { name: string; width: number; height: number };

/** The declared responsive matrix: small/large mobile, tablet boundary,
 *  laptop, desktop, wide desktop. */
export const VIEWPORTS: ViewportSpec[] = [
  { name: "small-mobile", width: 360, height: 740 },
  { name: "large-mobile", width: 480, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "wide", width: 1536, height: 960 },
];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export interface CapturedErrors {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
  /** Hard failures a route should never produce: uncaught errors + failed
   *  requests + >=400 responses (NOT console warnings, which are noisy in
   *  dev). */
  hardFailures(): string[];
  all(): string[];
}

/** URL fragments that are expected/benign and must not fail a route
 *  (dev tooling, telemetry beacons that legitimately 204/404). */
const BENIGN_URL = /\/_next\/(static|image)\/|__nextjs|hot-update|favicon\.ico/;

function attachErrorCapture(page: Page): CapturedErrors {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText ?? "";
    // Ignore navigation-cancelled aborts (normal during redirects).
    if (/ERR_ABORTED/.test(failure)) return;
    if (BENIGN_URL.test(req.url())) return;
    failedRequests.push(`${req.method()} ${req.url()} — ${failure}`);
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400 && !BENIGN_URL.test(res.url())) {
      badResponses.push(`${status} ${res.url()}`);
    }
  });

  return {
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses,
    hardFailures() {
      return [...this.pageErrors, ...this.failedRequests, ...this.badResponses];
    },
    all() {
      return [
        ...this.pageErrors,
        ...this.consoleErrors,
        ...this.failedRequests,
        ...this.badResponses,
      ];
    },
  };
}

export const test = base.extend<{ errors: CapturedErrors }>({
  errors: async ({ page }, applyFixture) => {
    const captured = attachErrorCapture(page);
    await applyFixture(captured);
  },
});

export { expect };

/** Emulate the given theme. The app reads `prefers-color-scheme` and a
 *  `data-theme` attribute on <html>; set both so the theme is stable
 *  regardless of which the surface consults. */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
}

/** Measure horizontal overflow of the root scroller at the current
 *  viewport. `overflow` is scrollWidth - clientWidth (px). */
export async function measureHorizontalOverflow(page: Page): Promise<{
  scrollWidth: number;
  clientWidth: number;
  overflow: number;
  offenders: string[];
}> {
  return page.evaluate(() => {
    const de = document.documentElement;
    const clientWidth = de.clientWidth;
    const scrollWidth = de.scrollWidth;
    const offenders: string[] = [];
    if (scrollWidth > clientWidth + 1) {
      // Identify the elements pushing past the viewport for diagnostics.
      const all = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1 && rect.width > 0 && rect.height > 0) {
          const id = el.id ? `#${el.id}` : "";
          const cls =
            typeof el.className === "string" && el.className
              ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
              : "";
          offenders.push(
            `${el.tagName.toLowerCase()}${id}${cls} right=${Math.round(rect.right)}`,
          );
          if (offenders.length >= 8) break;
        }
      }
    }
    return {
      scrollWidth,
      clientWidth,
      overflow: scrollWidth - clientWidth,
      offenders,
    };
  });
}

/** Log in to the admin surface via the real sign-in form. Uses
 *  `E2E_ADMIN_USERNAME`/`E2E_ADMIN_PASSWORD` (plaintext test password) —
 *  returns false when they are absent so auth-dependent tests skip
 *  instead of committing a secret or failing spuriously. */
export async function loginAsAdmin(page: Page): Promise<boolean> {
  const username = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!username || !password) return false;
  await page.goto("/admin/sign-in");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('button[type="submit"]'),
  ]);
  // Success = we are no longer on the sign-in page.
  return !page.url().includes("/admin/sign-in");
}
