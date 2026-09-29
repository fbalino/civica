import assert from "node:assert/strict";
import test from "node:test";
import {
  ciaCabinetSyncCronOutcome,
  officeholderSyncCronOutcome,
  reconciliationVerificationCronOutcome,
} from "./cron-outcomes";

test("CIA cabinet cron rejects mixed upstream failures and missing freshness", () => {
  assert.deepEqual(
    ciaCabinetSyncCronOutcome({
      skipped: [
        {
          slug: "ghana",
          code: "upstream_http_error",
          reason: "HTTP 503",
        },
      ],
      totalRowsWritten: 3,
      freshnessStamped: false,
      dryRun: false,
      countriesVerified: 1,
    }),
    {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "incomplete_stage",
    },
  );
  assert.deepEqual(
    ciaCabinetSyncCronOutcome({
      skipped: [],
      totalRowsWritten: 3,
      freshnessStamped: false,
      dryRun: false,
      countriesVerified: 1,
    }),
    {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "source_freshness_not_stamped",
    },
  );
});

test("CIA cabinet cron rejects a run that verified no country", () => {
  assert.deepEqual(
    ciaCabinetSyncCronOutcome({
      skipped: [],
      totalRowsWritten: 0,
      freshnessStamped: false,
      dryRun: false,
      countriesVerified: 0,
    }),
    {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "no_rows",
    },
  );
});

test("CIA cabinet cron accepts a clean write, an unchanged roster, and a dry-run plan", () => {
  for (const input of [
    {
      skipped: [],
      totalRowsWritten: 3,
      freshnessStamped: true,
      dryRun: false,
      countriesVerified: 1,
    },
    // DAT-037: an unchanged shard writes nothing and correctly does not stamp.
    {
      skipped: [],
      totalRowsWritten: 0,
      freshnessStamped: false,
      dryRun: false,
      countriesVerified: 9,
    },
    {
      skipped: [],
      totalRowsWritten: 3,
      freshnessStamped: false,
      dryRun: true,
      countriesVerified: 1,
    },
  ]) {
    assert.deepEqual(ciaCabinetSyncCronOutcome(input), {
      ok: true,
      outcome: "completed",
      healthOk: true,
      httpStatus: 200,
    });
  }
});

test("officeholder sync rejects partial and empty runs", () => {
  assert.deepEqual(
    officeholderSyncCronOutcome({
      status: "partial",
      countriesSynced: 1,
      totalRowsWritten: 12,
    }),
    {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "incomplete_stage",
    },
  );
  assert.deepEqual(
    officeholderSyncCronOutcome({
      status: "completed",
      countriesSynced: 1,
      totalRowsWritten: 0,
    }),
    {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "no_rows",
    },
  );
  assert.deepEqual(
    officeholderSyncCronOutcome({
      status: "completed",
      countriesSynced: 0,
      totalRowsWritten: 7,
    }),
    {
      ok: false,
      outcome: "partial",
      healthOk: false,
      httpStatus: 502,
      reason: "no_rows",
    },
  );
});

test("officeholder sync accepts only a complete run that produced rows", () => {
  assert.deepEqual(
    officeholderSyncCronOutcome({
      status: "completed",
      countriesSynced: 1,
      totalRowsWritten: 1,
    }),
    {
      ok: true,
      outcome: "completed",
      healthOk: true,
      httpStatus: 200,
    },
  );
});

test("reconciliation warnings complete with findings while true failures fail", () => {
  assert.deepEqual(
    reconciliationVerificationCronOutcome({ overallStatus: "pass" }),
    {
      ok: true,
      outcome: "completed",
      healthOk: true,
      httpStatus: 200,
    },
  );
  assert.deepEqual(
    reconciliationVerificationCronOutcome({ overallStatus: "warn" }),
    {
      ok: true,
      outcome: "completed_with_findings",
      healthOk: false,
      httpStatus: 200,
      reason: "verification_findings",
    },
  );
  assert.deepEqual(
    reconciliationVerificationCronOutcome({ overallStatus: "fail" }),
    {
      ok: false,
      outcome: "completed_with_findings",
      healthOk: false,
      httpStatus: 503,
      reason: "verification_findings",
    },
  );
});
