/**
 * PLT-033 — failed reads in cached pages.
 *
 * Database-backed public pages are served from the page cache. If a page
 * caught a database error and rendered an "unavailable" or empty state, that
 * degraded page would be cached and served until the next refresh. A cached
 * page therefore rethrows a failed read whenever a database is configured:
 * the render fails, Next.js keeps serving the last good page, and the daily
 * refresh records the failed URL.
 *
 * Without `DATABASE_URL` (the credential-free CI build) there is no database
 * to fail, so the existing unavailable states still render.
 *
 * Use this only around reads whose failure means the database or query
 * failed. A genuine empty result is not an error and keeps its own state.
 */
export function databaseFailureAbortsRender(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}

/** Call first inside a `catch` that wraps a database read in a cached page. */
export function rethrowDatabaseFailure(error: unknown): void {
  if (databaseFailureAbortsRender()) throw error;
}

/**
 * Predicate form for `captureAtlasSurfaceQuery(..., { rethrow })`. Every
 * error it sees wraps a database read, so only the configuration decides.
 */
export function isCachedRenderFailure(error: unknown): boolean {
  void error;
  return databaseFailureAbortsRender();
}

/**
 * Run a read and, only when no database is configured, substitute a
 * fallback on failure. With a database configured the error propagates.
 */
export async function readOrCredentialFreeFallback<T>(
  read: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    rethrowDatabaseFailure(error);
    return fallback();
  }
}

/**
 * `.catch()` handler form: rethrow when a database is configured, otherwise
 * return the fallback. Example: `getAllSources().catch(fallbackWithoutDatabase(() => []))`.
 */
export function fallbackWithoutDatabase<T>(
  fallback: () => T,
): (error: unknown) => T {
  return (error) => {
    rethrowDatabaseFailure(error);
    return fallback();
  };
}
