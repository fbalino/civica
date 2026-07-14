import assert from "node:assert/strict";
import { test } from "node:test";

import { currentMinuteSlot, latestCronScheduleSlot } from "./cron-schedule";

test("latestCronScheduleSlot selects the current exact occurrence", () => {
  assert.equal(
    latestCronScheduleSlot(
      "20 8 * * *",
      new Date("2026-07-14T08:20:49.999Z"),
    ).toISOString(),
    "2026-07-14T08:20:00.000Z",
  );
});

test("latestCronScheduleSlot walks back to the prior quarterly occurrence", () => {
  assert.equal(
    latestCronScheduleSlot(
      "0 8 2 1,4,7,10 *",
      new Date("2026-07-14T10:00:00.000Z"),
    ).toISOString(),
    "2026-07-02T08:00:00.000Z",
  );
});

test("latestCronScheduleSlot supports Vercel step schedules", () => {
  assert.equal(
    latestCronScheduleSlot(
      "10 */6 * * *",
      new Date("2026-07-14T17:59:00.000Z"),
    ).toISOString(),
    "2026-07-14T12:10:00.000Z",
  );
});

test("latestCronScheduleSlot finds a sparse annual occurrence", () => {
  assert.equal(
    latestCronScheduleSlot(
      "0 0 1 1 *",
      new Date("2026-12-31T23:59:59.999Z"),
    ).toISOString(),
    "2026-01-01T00:00:00.000Z",
  );
});

test("latestCronScheduleSlot rejects unsupported or malformed schedules", () => {
  assert.throws(
    () =>
      latestCronScheduleSlot("0 0 1 * 1", new Date("2026-07-14T00:00:00.000Z")),
    /cannot constrain day-of-month and day-of-week together/,
  );
  assert.throws(
    () => latestCronScheduleSlot("0 25 * * *", new Date()),
    /outside 0-23/,
  );
});

test("currentMinuteSlot removes seconds and milliseconds", () => {
  assert.equal(
    currentMinuteSlot(new Date("2026-07-14T01:02:59.999Z")).toISOString(),
    "2026-07-14T01:02:00.000Z",
  );
});
