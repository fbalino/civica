/**
 * QA-004 — the ONLY sanctioned path for a test to touch the live database.
 *
 * `getLiveReadOnlyDb()` refuses to construct outside the opt-in `npm run
 * test:db` harness (RUN_DB_TESTS=1) and returns a client whose mutation
 * methods throw, so a live-DB test can read production invariants but can
 * never modify production. `reportLiveTestEnvironment()` describes the target
 * with credentials AND the unique endpoint redacted, safe to print in test
 * output.
 *
 * Enforcement is two-layered: this runtime guard, plus the static scanner in
 * `src/lib/qa/live-db-test-isolation.test.ts` which fails if any test issues a
 * write against the production `db`.
 */
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { createServerlessSql, type CivicaDb } from "./index";

/** Drizzle methods that can mutate rows or run arbitrary DML/DDL. Refused on
 *  the live read-only client. */
export const REFUSED_MUTATION_METHODS = new Set([
  "insert",
  "update",
  "delete",
  "execute",
]);

/**
 * A live, read-only Drizzle client for the opt-in live-DB test harness.
 * Throws unless `RUN_DB_TESTS==='1'` and `DATABASE_URL` is set; the returned
 * client refuses every mutation method.
 */
export function getLiveReadOnlyDb(): CivicaDb {
  if (process.env.RUN_DB_TESTS !== "1") {
    throw new Error(
      "getLiveReadOnlyDb() is only available inside the opt-in live-DB test " +
        "harness (RUN_DB_TESTS=1). Use fixtures for ordinary tests.",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = createServerlessSql(process.env.DATABASE_URL);
  const client = drizzle({ client: sql, schema });
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && REFUSED_MUTATION_METHODS.has(prop)) {
        throw new Error(
          `Live test DB is read-only: '${prop}' is refused. Live-DB tests must ` +
            "never modify production.",
        );
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as CivicaDb;
}

/** Redact a database host down to its registrable domain so the provider is
 *  identifiable but the unique endpoint id is not echoed. */
function redactHost(host: string): string {
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host; // e.g. localhost / a bare host
  return `***.${labels.slice(-2).join(".")}`; // ep-x.us-east-2.aws.neon.tech -> ***.neon.tech
}

/**
 * A credential-free, endpoint-redacted description of the live test target,
 * safe to print. NEVER contains the username, password, or unique endpoint id
 * from `DATABASE_URL`.
 */
export function reportLiveTestEnvironment(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): string {
  if (!databaseUrl) return "live target: no DATABASE_URL configured";
  try {
    const u = new URL(databaseUrl);
    const provider = redactHost(u.hostname);
    const dbName = u.pathname.replace(/^\//, "") || "(default)";
    return `live target: ${provider} db=${dbName} (read-only; credentials + endpoint redacted)`;
  } catch {
    return "live target: (unparseable DATABASE_URL; credentials redacted)";
  }
}
