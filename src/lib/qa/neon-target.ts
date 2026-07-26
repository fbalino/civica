import { createHash } from "node:crypto";

export const NEON_TARGET_IDENTITY_SQL = `SELECT
  current_setting('neon.project_id', true) AS project_id,
  current_setting('neon.branch_id', true) AS branch_id,
  current_setting('neon.endpoint_id', true) AS endpoint_id`;

export const NEON_TARGET_LEDGER_HEAD_SQL =
  "SELECT id FROM civica_meta.schema_migrations ORDER BY id DESC LIMIT 1";

export interface NeonTargetExpectations {
  expectedProjectId: string;
  expectedBranchId: string;
  expectedHostnameSha256: string;
  forbiddenBranchId: string;
  forbiddenHostnameSha256: string;
  requiredMigrationHead: string;
}

export interface NeonTargetReport {
  projectId: string;
  branchId: string;
  endpointId: string;
  hostnameSha256: string;
  migrationHead: string | null;
  ledgerPresent: boolean;
  writesPerformed: 0;
}

interface NeonIdentityRow {
  project_id?: unknown;
  branch_id?: unknown;
  endpoint_id?: unknown;
}

interface MigrationHeadRow {
  id?: unknown;
}

export interface ReadOnlyNeonSql {
  query(query: string, params: unknown[]): Promise<unknown>;
}

function requiredArgument(
  argumentsList: readonly string[],
  prefix: string,
): string {
  const value = argumentsList
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value) {
    throw new Error(`Missing required argument ${prefix}<value>`);
  }
  return value;
}

export function neonTargetExpectationsFromArguments(
  argumentsList: readonly string[],
): NeonTargetExpectations {
  return {
    expectedProjectId: requiredArgument(argumentsList, "--expected-project="),
    expectedBranchId: requiredArgument(argumentsList, "--expected-branch="),
    expectedHostnameSha256: requiredArgument(
      argumentsList,
      "--expected-hostname-sha256=",
    ),
    forbiddenBranchId: requiredArgument(argumentsList, "--forbidden-branch="),
    forbiddenHostnameSha256: requiredArgument(
      argumentsList,
      "--forbidden-hostname-sha256=",
    ),
    requiredMigrationHead: requiredArgument(
      argumentsList,
      "--required-migration-head=",
    ),
  };
}

function requiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function databaseHostname(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname
  ) {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
  return parsed.hostname.toLowerCase();
}

export function neonHostnameSha256(hostname: string): string {
  return createHash("sha256").update(hostname.toLowerCase()).digest("hex");
}

function rows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error("Neon target inspection returned an invalid row set");
  }
  return value as Array<Record<string, unknown>>;
}

function isMissingLedgerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "42P01" || code === "3F000";
}

export async function readNeonTarget(
  sql: ReadOnlyNeonSql,
): Promise<{
  projectId: string;
  branchId: string;
  endpointId: string;
  migrationHead: string | null;
  ledgerPresent: boolean;
}> {
  let identityRows: Array<Record<string, unknown>>;
  try {
    identityRows = rows(await sql.query(NEON_TARGET_IDENTITY_SQL, []));
  } catch {
    throw new Error("Unable to read Neon target identity");
  }
  const identity = (identityRows[0] ?? {}) as NeonIdentityRow;
  const projectId = requiredText(identity.project_id);
  const branchId = requiredText(identity.branch_id);
  const endpointId = requiredText(identity.endpoint_id);
  if (!projectId || !branchId || !endpointId) {
    throw new Error("Neon target identity is incomplete");
  }

  let ledgerRows: Array<Record<string, unknown>>;
  try {
    ledgerRows = rows(await sql.query(NEON_TARGET_LEDGER_HEAD_SQL, []));
  } catch (error) {
    if (isMissingLedgerError(error)) {
      return {
        projectId,
        branchId,
        endpointId,
        migrationHead: null,
        ledgerPresent: false,
      };
    }
    throw new Error("Unable to read authoritative migration ledger head");
  }
  const migrationHead = ledgerRows.length
    ? requiredText((ledgerRows[0] as MigrationHeadRow).id)
    : null;
  if (ledgerRows.length && !migrationHead) {
    throw new Error("Authoritative migration ledger head is invalid");
  }
  return {
    projectId,
    branchId,
    endpointId,
    migrationHead,
    ledgerPresent: true,
  };
}

export function neonTargetErrors(
  report: NeonTargetReport,
  expectations: NeonTargetExpectations,
): string[] {
  const errors: string[] = [];
  if (!requiredText(report.projectId)) {
    errors.push("Neon project identity is absent");
  }
  if (!requiredText(report.branchId)) {
    errors.push("Neon branch identity is absent");
  }
  if (!requiredText(report.endpointId)) {
    errors.push("Neon endpoint identity is absent");
  }
  if (!/^[a-f0-9]{64}$/.test(report.hostnameSha256)) {
    errors.push("Neon hostname hash is invalid");
  }
  if (!requiredText(expectations.expectedProjectId)) {
    errors.push("expected project ID is required");
  } else if (report.projectId !== expectations.expectedProjectId) {
    errors.push("Neon project does not match the expected project");
  }
  if (!requiredText(expectations.expectedBranchId)) {
    errors.push("expected branch ID is required");
  } else if (expectations.expectedBranchId === expectations.forbiddenBranchId) {
    errors.push("expected branch must differ from the forbidden branch");
  } else if (report.branchId !== expectations.expectedBranchId) {
    errors.push("Neon branch does not match the expected branch");
  }
  if (!/^[a-f0-9]{64}$/.test(expectations.expectedHostnameSha256)) {
    errors.push("expected hostname hash must be SHA-256");
  } else if (
    expectations.expectedHostnameSha256 ===
    expectations.forbiddenHostnameSha256
  ) {
    errors.push("expected hostname must differ from the forbidden hostname");
  } else if (
    report.hostnameSha256 !== expectations.expectedHostnameSha256
  ) {
    errors.push("Neon hostname does not match the expected hostname");
  }
  if (!requiredText(expectations.forbiddenBranchId)) {
    errors.push("forbidden branch ID is required");
  } else if (report.branchId === expectations.forbiddenBranchId) {
    errors.push("Neon target is the forbidden branch");
  }
  if (!/^[a-f0-9]{64}$/.test(expectations.forbiddenHostnameSha256)) {
    errors.push("forbidden hostname hash must be SHA-256");
  } else if (
    report.hostnameSha256 === expectations.forbiddenHostnameSha256
  ) {
    errors.push("Neon target uses the forbidden hostname");
  }
  if (!requiredText(expectations.requiredMigrationHead)) {
    errors.push("required migration head is required");
  } else if (!report.ledgerPresent) {
    errors.push("authoritative migration ledger is absent");
  } else if (report.migrationHead !== expectations.requiredMigrationHead) {
    errors.push("authoritative migration ledger head does not match");
  }
  if (report.writesPerformed !== 0) {
    errors.push("Neon target inspection performed a write");
  }
  return errors;
}

export function validateNeonTarget(input: {
  databaseUrl: string;
  identity: {
    projectId: string;
    branchId: string;
    endpointId: string;
    migrationHead: string | null;
    ledgerPresent: boolean;
  };
  expectations: NeonTargetExpectations;
}): NeonTargetReport {
  const hostname = databaseHostname(input.databaseUrl);
  const report: NeonTargetReport = {
    projectId: input.identity.projectId,
    branchId: input.identity.branchId,
    endpointId: input.identity.endpointId,
    hostnameSha256: neonHostnameSha256(hostname),
    migrationHead: input.identity.migrationHead,
    ledgerPresent: input.identity.ledgerPresent,
    writesPerformed: 0,
  };
  const errors = neonTargetErrors(report, input.expectations);
  if (errors.length) {
    throw new Error(`Neon target rejected: ${errors.join("; ")}`);
  }
  return report;
}

export async function inspectNeonTarget(input: {
  databaseUrl: string;
  sql: ReadOnlyNeonSql;
  expectations: NeonTargetExpectations;
}): Promise<NeonTargetReport> {
  const identity = await readNeonTarget(input.sql);
  return validateNeonTarget({
    databaseUrl: input.databaseUrl,
    identity,
    expectations: input.expectations,
  });
}
