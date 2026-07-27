import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routeProfiles = [
  {
    file: "src/app/api/admin/advisory-applications/[id]/route.ts",
    codes: [
      "DELETION_CONFIRMATION_REQUIRED",
      "APPLICATION_NOT_FOUND",
      "INVALID_STATUS",
    ],
  },
  {
    file: "src/app/api/admin/data-disputes/[id]/route.ts",
    codes: [
      "INVALID_ACTION",
      "DISPUTE_NOT_FOUND",
      "DISPUTE_STATE_CONFLICT",
      "WINNING_FACT_NOT_FOUND",
    ],
  },
  {
    file: "src/app/api/admin/messages/[id]/route.ts",
    codes: ["INVALID_STATUS", "MESSAGE_NOT_FOUND"],
  },
  {
    file: "src/app/api/admin/pulse-review/[id]/route.ts",
    codes: [
      "EVENT_NOT_FOUND",
      "EVENT_NOT_CURRENT",
      "EVENT_NOT_PENDING",
      "INVALID_CLASSIFICATION",
    ],
  },
  {
    file: "src/app/api/admin/pulse-review/[id]/exception/route.ts",
    codes: ["INVALID_NOTE", "INVALID_EXPIRY", "CONFLICT"],
  },
  {
    file: "src/app/api/pulse-coding/admin/participants/route.ts",
    codes: [
      "INVALID_PARTICIPANT_REQUEST",
      "AGENT_USE_STATUS_INVALID",
      "STUDY_NOT_FOUND",
      "STUDY_EMPTY",
    ],
  },
] as const;

test("admin mutation routes expose fixed error codes without dynamic error copy", () => {
  for (const profile of routeProfiles) {
    const source = readFileSync(path.join(process.cwd(), profile.file), "utf8");
    for (const code of profile.codes) {
      assert.equal(
        source.includes(`"${code}"`),
        true,
        `${profile.file} is missing ${code}`,
      );
    }

    assert.doesNotMatch(
      source,
      /NextResponse\.json\(\s*\{\s*error\s*:/,
      `${profile.file} has an ad-hoc error response without the shared profile`,
    );
    assert.doesNotMatch(
      source,
      /error\s*:\s*(?:`|validation\.error|error\.message)/,
      `${profile.file} reflects dynamic error copy`,
    );
  }
});

test("mapped store failures rethrow unknown messages to the generic boundary", () => {
  for (const file of [
    "src/app/api/admin/pulse-review/[id]/exception/route.ts",
    "src/app/api/pulse-coding/admin/participants/route.ts",
  ]) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(source, /if \(!problem\) throw error;/);
    assert.doesNotMatch(source, /error\s*:\s*error\.message/);
  }
});
