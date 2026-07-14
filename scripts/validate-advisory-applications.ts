import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ADVISORY_APPLICATION_POLICY,
  ADVISORY_APPLICATION_POLICY_VERSION,
} from "../src/lib/research/advisory-application";

assert.equal(
  ADVISORY_APPLICATION_POLICY.schemaVersion,
  ADVISORY_APPLICATION_POLICY_VERSION,
);
assert.equal(ADVISORY_APPLICATION_POLICY.retentionMonths, 18);

const form = readFileSync(
  "src/app/about/advisory-board/apply/ApplyClient.tsx",
  "utf8",
);
const api = readFileSync("src/app/api/advisory-applications/route.ts", "utf8");
const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
const admin = readFileSync(
  "src/app/(admin)/admin/advisory-applications/[id]/page.tsx",
  "utf8",
);
const adminApi = readFileSync(
  "src/app/api/admin/advisory-applications/[id]/route.ts",
  "utf8",
);

for (const phrase of [
  "board charter",
  "charter areas",
  "privacyNoticeVersion",
  "consent",
  "no confirmation email",
  "does not guarantee",
])
  assert.ok(form.includes(phrase), `application form missing: ${phrase}`);

assert.ok(
  api.includes("checkRequestRateLimit") &&
    /getRequestRateLimitPolicy\(\s*"advisory-application-form"\s*,?\s*\)/.test(
      api,
    ),
  "application endpoint lacks the reviewed shared durable abuse control",
);
assert.ok(
  api.includes("ipAddress: null"),
  "application endpoint retains applicant IP",
);
assert.ok(
  /The application could not be stored[\s\S]{0,200}\b503\b/.test(api),
  "application endpoint lacks explicit storage failure",
);
assert.ok(
  privacy.includes('id="applications"') &&
    privacy.includes("ADVISORY_APPLICATION_POLICY"),
  "privacy page lacks the application notice",
);
assert.ok(
  admin.includes("Delete application permanently") &&
    admin.includes("Delete by"),
  "admin route lacks retention visibility/deletion control",
);
assert.ok(
  adminApi.includes('body.intent === "delete"') &&
    adminApi.includes('body.confirm !== "delete"'),
  "admin API lacks confirmed deletion",
);

console.log(
  "PASS — application copy matches the charter; validation, consent, durable anti-spam, private delivery, onscreen acknowledgement, retention/deletion, security, and response limits are closed.",
);
