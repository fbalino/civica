/** ATL-020 — fixture-backed release-history reader journeys. */
import type { Page } from "@playwright/test";

import { expect, test } from "./harness/fixtures";

const FACT_ID = "123e4567-e89b-42d3-a456-426614174000";
const HISTORY_PATTERN = /\/api\/citations\/fact\/[^/]+\/history/;

function historyDocument(input: {
  events?: Array<Record<string, unknown>>;
  hasMore?: boolean;
}) {
  return {
    schemaVersion: "civica-atlas-change-history/v1",
    entity: {
      entityType: "fact",
      entityId: FACT_ID,
      label: "Fixture observation",
      citationUrl: `https://civicaatlas.org/api/citations/fact/${FACT_ID}`,
      readerUrl: "https://civicaatlas.org/country/united-states",
    },
    coverage: {
      state: input.events?.length
        ? "recorded_history"
        : "no_recorded_history",
      note:
        "Public history begins with releases recorded under the Civica Atlas change-history contract.",
    },
    events: input.events ?? [],
    pagination: {
      limit: 5,
      offset: 0,
      hasMore: input.hasMore ?? false,
    },
  };
}

const routineEvent = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  entityType: "fact",
  entityId: FACT_ID,
  operation: "update",
  changeKind: "routine_refresh",
  changes: [
    { field: "fact_value", before: "10", after: "12" },
    {
      field: "upstream_vintage_label",
      before: "2024",
      after: "2025",
    },
  ],
  reason: "Publisher annual refresh",
  methodologyVersion: "fact-reconciliation-v1",
  releaseId: "atlas-2026-07",
  correction: null,
  recordedAt: "2026-07-23T10:00:00.000Z",
};

const publicCorrectionEvent = {
  ...routineEvent,
  id: "323e4567-e89b-42d3-a456-426614174000",
  changeKind: "correction",
  reason: "Corrected publisher transcription",
  releaseId: "atlas-2026-07-correction-1",
  correction: {
    id: "423e4567-e89b-42d3-a456-426614174000",
    status: "resolved_corrected",
  },
};

async function openFirstFactHistory(page: Page) {
  await page.goto("/country/united-states", {
    waitUntil: "domcontentloaded",
  });
  const trigger = page.locator(".fact-value-trigger").first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Release history" }),
  ).toBeVisible();
}

test("recorded refresh, public correction, withheld detail, and pagination remain distinct", async ({
  page,
  errors,
}) => {
  const requestedOffsets: number[] = [];
  await page.route(HISTORY_PATTERN, async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    requestedOffsets.push(offset);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        historyDocument(
          offset === 0
            ? {
                events: [
                  routineEvent,
                  {
                    ...publicCorrectionEvent,
                    id: "523e4567-e89b-42d3-a456-426614174000",
                    reason: "Private correction detail withheld",
                    correction: null,
                  },
                ],
                hasMore: true,
              }
            : { events: [publicCorrectionEvent] },
        ),
      ),
    });
  });

  await openFirstFactHistory(page);
  await expect(page.getByText("Routine refresh", { exact: true })).toBeVisible();
  await expect(page.getByText("Private correction detail withheld")).toBeVisible();
  await expect(page.getByText(/Public correction status/)).toHaveCount(0);

  await page.getByRole("button", { name: "Load earlier changes" }).click();
  await expect(page.getByText("Corrected publisher transcription")).toBeVisible();
  await expect(page.getByText(/Public correction status/)).toContainText(
    "Resolved Corrected",
  );
  expect(requestedOffsets).toContain(0);
  expect(requestedOffsets).toContain(2);
  expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
});

test("no recorded history is not presented as a missing entity", async ({
  page,
  errors,
}) => {
  await page.route(HISTORY_PATTERN, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(historyDocument({})),
    });
  });

  await openFirstFactHistory(page);
  await expect(page.getByText("No recorded public history")).toBeVisible();
  await expect(
    page.getByText(/Public history begins with releases recorded/),
  ).toBeVisible();
  expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
});

test("unavailable history preserves the current observation", async ({
  page,
}) => {
  await page.route(HISTORY_PATTERN, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Temporarily unavailable" }),
    });
  });

  await openFirstFactHistory(page);
  await expect(
    page.getByText(/Release history is temporarily unavailable/),
  ).toBeVisible();
  await expect(page.locator(".fact-value-row--canonical").first()).toBeVisible();
});
