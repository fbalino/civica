import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import {
  createBoundedServerlessDbFetch,
  SERVERLESS_DB_HTTP_TIMEOUT_MS,
} from "./serverless";

/** The Civica Drizzle client type, shared so helpers (e.g. the live-read-only
 *  test client) can annotate against it without re-deriving the generic. */
export type CivicaDb = NeonHttpDatabase<typeof schema>;

let _db: NeonHttpDatabase<typeof schema> | null = null;
let serverlessFetchInstalled = false;

/**
 * Install one timeout-aware HTTP transport for the Neon driver in this
 * process. The transport has no automatic retry because a timed-out write has
 * an unknown commit outcome; durable idempotency must decide any replay.
 */
export function installServerlessDbTransport(): void {
  if (serverlessFetchInstalled) return;
  const fetchImpl = neonConfig.fetchFunction ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("A Fetch-compatible implementation is required for the Neon HTTP driver");
  }
  neonConfig.fetchFunction = createBoundedServerlessDbFetch(
    fetchImpl,
    SERVERLESS_DB_HTTP_TIMEOUT_MS,
  );
  serverlessFetchInstalled = true;
}

/** Use this factory for every serverless HTTP Neon client, including raw SQL. */
export function createServerlessSql(databaseUrl: string) {
  installServerlessDbTransport();
  return neon(databaseUrl);
}

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const sql = createServerlessSql(process.env.DATABASE_URL);
    _db = drizzle({ client: sql, schema });
  }
  return _db;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
