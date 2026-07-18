import assert from "node:assert/strict";
import { test } from "node:test";

import {
  READER_BROWSER_SUPPORT,
  READER_DEGRADATION_MODES,
  readerBrowserSupportContractErrors,
} from "./browser-degradation-contract";

test("reader browser support declares all pinned critical-journey profiles", () => {
  assert.deepEqual(readerBrowserSupportContractErrors(), []);
  assert.deepEqual(
    READER_BROWSER_SUPPORT.map((profile) => profile.project),
    ["chromium", "firefox", "webkit"],
  );
});

test("a missing support profile or degradation mode fails closed", () => {
  assert.ok(
    readerBrowserSupportContractErrors(
      READER_BROWSER_SUPPORT.filter((profile) => profile.project !== "webkit"),
    ).includes("missing webkit support profile"),
  );
  assert.ok(
    readerBrowserSupportContractErrors(
      READER_BROWSER_SUPPORT,
      READER_DEGRADATION_MODES.filter(
        (degradation) => degradation.id !== "pulse-source-outage",
      ),
    ).includes("missing pulse-source-outage degradation mode"),
  );
});
