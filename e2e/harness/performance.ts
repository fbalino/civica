import type { Page, Response } from "@playwright/test";

import type { ReaderPerformanceMetrics } from "../../src/lib/qa/reader-performance-budget";

type BrowserPerformanceState = {
  lcpMs: number;
  cls: number;
  longTasks: number[];
  interactions: number[];
};

type BrowserWindow = Window & {
  __civicaReaderPerformance?: BrowserPerformanceState;
};

export async function installReaderPerformanceObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type PerformanceEntryWithDetails = PerformanceEntry & {
      value?: number;
      hadRecentInput?: boolean;
      duration: number;
      interactionId?: number;
    };
    const state: BrowserPerformanceState = {
      lcpMs: 0,
      cls: 0,
      longTasks: [],
      interactions: [],
    };
    (window as BrowserWindow).__civicaReaderPerformance = state;
    const observe = (
      type: string,
      onEntry: (entry: PerformanceEntryWithDetails) => void,
      options?: PerformanceObserverInit & { durationThreshold?: number },
    ) => {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            onEntry(entry as PerformanceEntryWithDetails);
        }).observe({ type, buffered: true, ...options });
      } catch {
        // The test runs in Chromium, but a metric unsupported by a future
        // browser must surface as a missing measurement below, not a crash.
      }
    };
    observe("largest-contentful-paint", (entry) => {
      state.lcpMs = Math.max(state.lcpMs, entry.startTime);
    });
    observe("layout-shift", (entry) => {
      if (!entry.hadRecentInput) state.cls += entry.value ?? 0;
    });
    observe("longtask", (entry) => state.longTasks.push(entry.duration));
    observe(
      "event",
      (entry) => {
        if ((entry.interactionId ?? 0) > 0)
          state.interactions.push(entry.duration);
      },
      { durationThreshold: 16 },
    );
  });
}

function responseCategory(response: Response):
  | "htmlBytes"
  | "rscBytes"
  | "javascriptBytes"
  | "cssBytes"
  | "imageBytes"
  | "fontBytes"
  | null {
  const type = response.request().resourceType();
  const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
  const pathname = new URL(response.url()).pathname.toLowerCase();
  if (contentType.includes("text/x-component")) return "rscBytes";
  if (type === "document" || contentType.includes("text/html")) return "htmlBytes";
  if (type === "script" || /\.(?:m?js)$/.test(pathname)) return "javascriptBytes";
  if (type === "stylesheet" || contentType.includes("text/css")) return "cssBytes";
  if (type === "font" || /\.(?:woff2?|ttf|otf)$/.test(pathname)) return "fontBytes";
  if (type === "image" || contentType.startsWith("image/")) return "imageBytes";
  return null;
}

async function decodedResponseBytes(response: Response): Promise<number> {
  try {
    return (await response.body()).byteLength;
  } catch {
    const header = Number(response.headers()["content-length"] ?? "0");
    return Number.isFinite(header) && header >= 0 ? header : 0;
  }
}

/**
 * Collect fresh-context decoded payload totals plus native PerformanceObserver
 * entries. The budget deliberately counts the actual browser requests,
 * including external map inputs, rather than trusting page-source imports.
 */
export async function collectReaderPerformanceMetrics(
  page: Page,
  responses: readonly Response[],
  mapInitializationMs: number | null,
): Promise<ReaderPerformanceMetrics> {
  const totals: Pick<
    ReaderPerformanceMetrics,
    | "htmlBytes"
    | "rscBytes"
    | "javascriptBytes"
    | "cssBytes"
    | "imageBytes"
    | "fontBytes"
  > = {
    htmlBytes: 0,
    rscBytes: 0,
    javascriptBytes: 0,
    cssBytes: 0,
    imageBytes: 0,
    fontBytes: 0,
  };

  const successful = responses.filter(
    (response) => response.request().method() === "GET" && response.status() < 400,
  );
  for (const response of successful) {
    const category = responseCategory(response);
    if (category) totals[category] += await decodedResponseBytes(response);
  }

  const browser = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const state = (window as BrowserWindow).__civicaReaderPerformance;
    return {
      responseStart: navigation?.responseStart ?? 0,
      lcpMs: state?.lcpMs ?? 0,
      cls: state?.cls ?? 0,
      interactions: state?.interactions ?? [],
      longTasks: state?.longTasks ?? [],
    };
  });

  if (browser.lcpMs <= 0)
    throw new Error("reader-performance: LCP was not observed");
  if (browser.interactions.length === 0)
    throw new Error("reader-performance: INP interaction was not observed");

  return {
    ...totals,
    requestCount: successful.length,
    serverResponseMs: Math.round(browser.responseStart),
    lcpMs: Math.round(browser.lcpMs),
    cls: Number(browser.cls.toFixed(4)),
    inpMs: Math.round(Math.max(...browser.interactions)),
    longestLongTaskMs: Math.round(Math.max(0, ...browser.longTasks)),
    longTaskCount: browser.longTasks.length,
    mapInitializationMs:
      mapInitializationMs === null ? null : Math.round(mapInitializationMs),
  };
}
