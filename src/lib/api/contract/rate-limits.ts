/**
 * PLT-011 — canonical public read-API limits. Runtime enforcement and the
 * public contract import these values instead of maintaining separate
 * literals. Only GET requests consume the shared PostgreSQL counter;
 * OPTIONS preflight requests remain uncounted.
 */
export const V1_RATE_LIMIT_MAX = 60;
export const V1_RATE_LIMIT_WINDOW_MS = 60_000;
export const EXPORT_RATE_LIMIT_MAX = 30;
export const EXPORT_RATE_LIMIT_WINDOW_MS = 60_000;

export const RATE_LIMIT_EXCEEDED_STATUS = 429;
export const RATE_LIMIT_STORE_UNAVAILABLE_STATUS = 503;
