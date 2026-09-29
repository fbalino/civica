/**
 * DAT-037 one-time repair of stored CIA World Leaders cabinet terms.
 *
 * Modes (zero-write plan is the default):
 *
 *   --plan [--out=<file>]
 *       Read one consistent read-only snapshot and write the deterministic
 *       plan (IDs, row digests, category counts, non-target fingerprints, and
 *       its own SHA-256; no names or payload text).
 *
 *   --apply --plan-file=<file> --expected-plan-sha256=<hex>
 *           --release-id=<label> --correction-log-id=<uuid> [--out=<file>]
 *       Apply exactly that plan in one transaction. The transaction locks the
 *       cabinet tables, asserts every planned row is still in its planned
 *       before-state (or already repaired) and that no other cabinet row
 *       changed since the plan, applies guarded set-based writes, and asserts
 *       the after-state; any mismatch raises and rolls everything back. The
 *       correction record must exist and be `in_review`. Never stamps source
 *       freshness.
 *
 *   --verify [--plan-file=<file>] [--apply-report=<file>]
 *       Read-only postflight (P1–P11).
 *
 * Target guard: the host is printed before anything else. A loopback host
 * (localhost, 127.0.0.1, ::1) is allowed. Any other host requires
 * `--production-host=<exact host>`; `--apply` additionally requires
 * `--approval-evidence=<owner approval file>` and
 * `--confirm=APPLY-<first 12 characters of the plan SHA-256>`.
 */
// civica-affected-relations: research_evidence_history,statements,terms
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
  applyCabinetTermRepair,
  loadCabinetRepairState,
  planCabinetTermRepair,
  verifyCabinetTermRepair,
  verifyPlanDigest,
  type CabinetRepairExecutor,
  type CabinetRepairPlan,
} from "../src/lib/factbook/cabinet-term-repair";

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

function createExecutor(databaseUrl: string): CabinetRepairExecutor {
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

function readPlan(path: string | undefined): CabinetRepairPlan {
  if (!path || !existsSync(path)) fail("--plan-file must name an existing plan");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    plan?: CabinetRepairPlan;
  } & Partial<CabinetRepairPlan>;
  const plan = (parsed.plan ?? parsed) as CabinetRepairPlan;
  if (!verifyPlanDigest(plan)) fail("the plan file's contents do not match its SHA-256");
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required");
  const host = targetHost(databaseUrl);
  const loopback = LOOPBACK_HOSTS.has(host);
  console.error(`Target database host: ${host}${loopback ? " (loopback)" : ""}`);

  const mode = flag("apply") ? "apply" : flag("verify") ? "verify" : "plan";
  if (!loopback) {
    if (arg("production-host") !== host) {
      fail(
        `non-loopback host ${host} requires --production-host=${host}; plan and verify are read-only`,
      );
    }
  }

  const executor = createExecutor(databaseUrl);
  const out = arg("out");

  if (mode === "plan") {
    const plan = planCabinetTermRepair(await loadCabinetRepairState(executor));
    emit({ mode: "zero_write_plan", targetHost: host, generatedAt: new Date().toISOString(), plan }, out);
    console.error(`Plan SHA-256: ${plan.planSha256}`);
    return;
  }

  if (mode === "verify") {
    const planFile = arg("plan-file");
    const plan = planFile ? readPlan(planFile) : undefined;
    const reportFile = arg("apply-report");
    const report = reportFile
      ? (JSON.parse(readFileSync(reportFile, "utf8")) as {
          result?: { transactionStartedAt?: string };
        })
      : undefined;
    const verification = await verifyCabinetTermRepair(executor, {
      plan,
      transactionStartedAt: report?.result?.transactionStartedAt,
    });
    emit({ mode: "read_only_verify", targetHost: host, verifiedAt: new Date().toISOString(), verification }, out);
    if (!verification.pass) process.exitCode = 1;
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  const planFile = arg("plan-file");
  const plan = readPlan(planFile);
  const expected = arg("expected-plan-sha256");
  if (!expected || expected !== plan.planSha256) {
    fail("--expected-plan-sha256 must equal the plan file's SHA-256");
  }
  const releaseId = resolveAtlasReleaseId(arg("release-id"));
  const correctionLogId = arg("correction-log-id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(correctionLogId)) {
    fail("--correction-log-id must be the approved correction record UUID");
  }
  if (!loopback) {
    const evidence = arg("approval-evidence");
    if (!evidence || !existsSync(evidence)) {
      fail("--approval-evidence must name the owner's written approval record");
    }
    if (arg("confirm") !== `APPLY-${plan.planSha256.slice(0, 12)}`) {
      fail(`--confirm must equal APPLY-${plan.planSha256.slice(0, 12)}`);
    }
  }
  const [correction] = await executor.read([
    sql`SELECT status FROM correction_log WHERE id = ${correctionLogId}::uuid`,
  ]);
  if (correction[0]?.status !== "in_review") {
    fail(
      `correction ${correctionLogId} must exist and be in_review before the linked repair; found ${String(correction[0]?.status ?? "missing")}`,
    );
  }

  const result = await applyCabinetTermRepair(executor, plan);
  emit(
    {
      mode: "authorized_apply",
      targetHost: host,
      releaseId,
      correctionLogId,
      planSha256: plan.planSha256,
      expectedHistoryRows: plan.expectedHistoryRows,
      result,
    },
    out,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
