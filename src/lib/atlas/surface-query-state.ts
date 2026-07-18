/**
 * A query state for Atlas reader modules.
 *
 * Reader pages often keep rendering when one independent query fails. They
 * must not, however, convert that failure into an empty array or null and
 * imply that the country has no record. This closed result type keeps those
 * two outcomes separate until the renderer chooses its visible state.
 */
export type AtlasSurfaceQueryState<T> =
  | { status: "available"; value: T }
  | { status: "unavailable" };

export async function captureAtlasSurfaceQuery<T>(
  query: () => Promise<T>,
  options: { rethrow?: (error: unknown) => boolean } = {},
): Promise<AtlasSurfaceQueryState<T>> {
  try {
    return { status: "available", value: await query() };
  } catch (error) {
    if (options.rethrow?.(error)) throw error;
    return { status: "unavailable" };
  }
}

export function atlasSurfaceQueryValue<T>(
  state: AtlasSurfaceQueryState<T>,
): T | null {
  return state.status === "available" ? state.value : null;
}
