/**
 * DAT-038 one-time repair of stored bill last-action dates
 * (`bill-last-action-date-repair/v1`, logic in
 * `src/lib/bills/last-action-repair.ts`).
 *
 * Requires authoritative migration 0052 (typed last-action date columns).
 *
 * Modes (zero-write plan is the default):
 *
 *   --plan [--out=<file>]
 *       Read one consistent read-only snapshot, re-derive every bill's
 *       last-action date (and Bundestag DIP's introduction date) from its
 *       retained publisher payload, and write the deterministic plan: IDs,
 *       before/after dates and states, payload guards, per-source counts,
 *       the non-target fingerprint, and its own SHA-256. `bills` has no
 *       history trigger, so keep this file with the recovery snapshot: its
 *       before-states are the compensation input.
 *
 *   --apply --plan-file=<file> --expected-plan-sha256=<hex>
 *           --release-id=<label>
 *           (--public-correction=waived-prelaunch | --correction-log-id=<uuid>)
 *           [--out=<file>]
 *       Apply exactly that plan in one transaction: lock `bills`, assert every
 *       target is still in its before-state (or already repaired) with an
 *       unchanged payload and write time, assert no other bill changed, update,
 *       and assert the after-state; any mismatch rolls everything back. Never
 *       stamps source freshness and never changes `updated_at`.
 *
 *   --verify [--plan-file=<file>]
 *       Read-only postflight (V1–V5).
 *
 * Target guard: the host is printed before anything else. A loopback host is
 * allowed. Any other host requires `--production-host=<exact host>`; `--apply`
 * additionally requires `--approval-evidence=<owner approval file>` and
 * `--confirm=APPLY-<first 12 characters of the plan SHA-256>`. The approval
 * file must be non-empty, name `bill-last-action-date-repair/v1`, contain the
 * full plan SHA-256 (appended after planning), and record APR-D173 when the
 * prelaunch waiver is used.
 */
// civica-affected-relations: bills
import { config } from "dotenv";

config({ path: ".env.local" });

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { neon, neonConfig } from "@neondatabase/serverless";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { createBoundedServerlessDbFetch } from "../src/lib/db/serverless";
import { resolveAtlasReleaseId } from "../src/lib/factbook/country-fact-history-writer";
import {
  checkApprovalEvidence,
  parsePublicCorrectionChoice,
} from "../src/lib/factbook/cabinet-repair-authorization";
import {
  applyBillDateRepair,
  BILL_DATE_REPAIR_METHOD,
  loadBillDateRepairState,
  planBillDateRepair,
  verifyBillDatePlanDigest,
  verifyBillDateRepair,
  type BillDateRepairExecutor,
  type BillDateRepairPlan,
} from "../src/lib/bills/last-action-repair";

/** An explicit operator timeout; the transaction is one HTTP request. */
const OPERATOR_TIMEOUT_MS = 60_000;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function fail(message: string): never {
  console.error(`REFUSED: ${message}`);
  process.exit(1);
}

function targetHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return fail("DATABASE_URL is not a valid connection URL");
  }
}

function createExecutor(databaseUrl: string): BillDateRepairExecutor {
  neonConfig.fetchFunction = createBoundedServerlessDbFetch(
    neonConfig.fetchFunction ?? globalThis.fetch,
    OPERATOR_TIMEOUT_MS,
  );
  const client = neon(databaseUrl);
  const dialect = new PgDialect();
  const compile = (statements: SQL[]) =>
    statements.map((statement) => {
      const query = dialect.sqlToQuery(statement);
      return client.query(query.sql, query.params);
    });
  return {
    read: async (statements) =>
      (await client.transaction(compile(statements), {
        readOnly: true,
        isolationLevel: "RepeatableRead",
      })) as unknown as Record<string, unknown>[][],
    write: async (statements) =>
      (await client.transaction(compile(statements), {
        isolationLevel: "ReadCommitted",
      })) as unknown as Record<string, unknown>[][],
  };
}

function readPlan(path: string | undefined): BillDateRepairPlan {
  if (!path || !existsSync(path)) fail("--plan-file must name an existing plan");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    plan?: BillDateRepairPlan;
  } & Partial<BillDateRepairPlan>;
  const plan = (parsed.plan ?? parsed) as BillDateRepairPlan;
  if (!verifyBillDatePlanDigest(plan)) fail("the plan file's contents do not match its SHA-256");
  return plan;
}

function emit(payload: unknown, out: string | undefined) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  if (out) {
    writeFileSync(out, text);
    console.log(`Wrote ${out} (sha256 ${createHash("sha256").update(text).digest("hex")})`);
  } else {
    process.stdout.write(text);
  }
}

/** Counts only: safe to paste into evidence. */
function planSummary(plan: BillDateRepairPlan) {
  return {
    planSha256: plan.planSha256,
    rowsRead: plan.rowsRead,
    totals: plan.totals,
    bySource: plan.bySource,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required");
  const host = targetHost(databaseUrl);
  const loopback = LOOPBACK_HOSTS.has(host);
  console.error(`Target database host: ${host}${loopback ? " (loopback)" : ""}`);

  const mode = flag("apply") ? "apply" : flag("verify") ? "verify" : "plan";
  if (!loopback && arg("production-host") !== host) {
    fail(
      `non-loopback host ${host} requires --production-host=${host}; plan and verify are read-only`,
    );
  }

  const executor = createExecutor(databaseUrl);
  const [columns] = await executor.read([
    sql`SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bills'
        AND column_name IN ('last_action_date_status', 'last_action_date_reason')`,
  ]);
  if (Number(columns[0]?.n) !== 2) {
    fail("bills lacks the typed last-action columns; apply authoritative migration 0052 first");
  }
  const out = arg("out");

  if (mode === "plan") {
    const plan = planBillDateRepair(await loadBillDateRepairState(executor));
    emit({ mode: "zero_write_plan", targetHost: host, generatedAt: new Date().toISOString(), plan }, out);
    console.error(JSON.stringify(planSummary(plan), null, 2));
    console.error(`Plan SHA-256: ${plan.planSha256}`);
    return;
  }

  if (mode === "verify") {
    const planFile = arg("plan-file");
    const plan = planFile ? readPlan(planFile) : undefined;
    const verification = await verifyBillDateRepair(executor, { plan });
    emit({ mode: "read_only_verify", targetHost: host, verifiedAt: new Date().toISOString(), verification }, out);
    if (!verification.pass) process.exitCode = 1;
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  const plan = readPlan(arg("plan-file"));
  const expected = arg("expected-plan-sha256");
  if (!expected || expected !== plan.planSha256) {
    fail("--expected-plan-sha256 must equal the plan file's SHA-256");
  }
  if (plan.methodologyVersion !== BILL_DATE_REPAIR_METHOD) {
    fail(`the plan was built with ${String(plan.methodologyVersion)}, not ${BILL_DATE_REPAIR_METHOD}`);
  }
  const releaseId = resolveAtlasReleaseId(arg("release-id"));
  const correction = parsePublicCorrectionChoice({
    publicCorrection: arg("public-correction"),
    correctionLogId: arg("correction-log-id"),
  });
  if (!correction.ok) fail(correction.reason);
  const choice = correction.value;
  const evidence = arg("approval-evidence");
  if (!loopback && !evidence) {
    fail("--approval-evidence must name the owner's written approval record");
  }
  let approvalEvidence: { path: string; sha256: string } | null = null;
  if (evidence) {
    if (!existsSync(evidence)) fail("--approval-evidence must name an existing file");
    const bytes = readFileSync(evidence);
    const checked = checkApprovalEvidence(bytes.toString("utf8"), {
      planSha256: plan.planSha256,
      methodologyVersion: BILL_DATE_REPAIR_METHOD,
      choice,
    });
    if (!checked.ok) fail(checked.reason);
    approvalEvidence = {
      path: evidence,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  if (!loopback && arg("confirm") !== `APPLY-${plan.planSha256.slice(0, 12)}`) {
    fail(`--confirm must equal APPLY-${plan.planSha256.slice(0, 12)}`);
  }
  if (choice.kind === "correction_record") {
    const [correctionRows] = await executor.read([
      sql`SELECT status FROM correction_log WHERE id = ${choice.correctionLogId}::uuid`,
    ]);
    if (correctionRows[0]?.status !== "in_review") {
      fail(
        `correction ${choice.correctionLogId} must exist and be in_review before the linked repair; found ${String(correctionRows[0]?.status ?? "missing")}`,
      );
    }
  }

  const result = await applyBillDateRepair(executor, plan);
  emit(
    {
      mode: "authorized_apply",
      targetHost: host,
      releaseId,
      publicCorrection: choice,
      approvalEvidence,
      summary: planSummary(plan),
      result,
    },
    out,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
