import { after } from "next/server";
import { lt, sql } from "drizzle-orm";

import {
  ROUTE_INVENTORY,
  type HttpMethod,
  type RouteInventoryEntry,
} from "@/lib/api/route-inventory/registry";
import { db } from "@/lib/db";
import { routePerformanceObservations } from "@/lib/db/schema";
import {
  ROUTE_FRESHNESS_POLICY,
  type CacheProfileId,
} from "@/lib/platform/cache-consistency";

export const ROUTE_PERFORMANCE_TELEMETRY_VERSION =
  "civica-route-performance/v1" as const;
export const ROUTE_PERFORMANCE_RETENTION_DAYS = 30;
export const ROUTE_PERFORMANCE_WINDOW_HOURS = 24;

/**
 * Request telemetry is uniformly sampled so a per-request database write does
 * not scale with traffic. Only the `request` surface is sampled: job and
 * server-error observations are always recorded, so the sampled request count
 * is the single quantity downstream consumers must rate-correct.
 *
 * The sample is deliberately uniform. Exempting slow requests would keep the
 * tail while discarding the body of the distribution, which would turn the
 * stored `p95` into something that is no longer a percentile of real traffic.
 * The proxy also cannot know the response status, so an error-based exemption
 * is not available there; `onRequestError` records errors on its own unsampled
 * path.
 */
export const ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE: number = 0.05;

export type RoutePerformanceSurface = "request" | "job" | "error";
export type RoutePerformanceMetric =
  "request_duration_ms" | "job_duration_ms" | "server_error";
export type RoutePerformanceMethod = HttpMethod | "DOCUMENT" | "UNKNOWN";
export type TelemetryCacheProfile = CacheProfileId | "document" | null;

export interface RoutePerformanceObservation {
  routeId: string;
  method: RoutePerformanceMethod;
  surface: RoutePerformanceSurface;
  metric: RoutePerformanceMetric;
  durationMs: number | null;
  httpStatus: number | null;
  cacheProfile: TelemetryCacheProfile;
  releaseId: string;
  telemetryVersion: typeof ROUTE_PERFORMANCE_TELEMETRY_VERSION;
}

export interface RoutePerformanceStore {
  insert(observation: RoutePerformanceObservation): Promise<void>;
  pruneBefore(before: Date): Promise<number>;
}

export interface RoutePerformanceSummary {
  routeId: string;
  method: RoutePerformanceMethod;
  surface: RoutePerformanceSurface;
  metric: RoutePerformanceMetric;
  cacheProfile: TelemetryCacheProfile;
  releaseId: string;
  sampleCount: number;
  p95Ms: number | null;
  averageMs: number | null;
}

export interface RoutePerformanceAlert {
  id: "request_p95" | "job_p95" | "server_error_rate";
  routeId: string;
  releaseId: string;
  cacheProfile: TelemetryCacheProfile;
  detail: string;
}

const VALID_METHODS = new Set<RoutePerformanceMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "DOCUMENT",
  "UNKNOWN",
]);
const VALID_CACHE_PROFILES = new Set<TelemetryCacheProfile>([
  "public-live",
  "private-live",
  "checked-build-artifact",
  "immutable-release",
  "build-static",
  "build-revalidated",
  "document",
  null,
]);
const MAX_DURATION_MS = 60 * 60 * 1_000;

type RouteTemplate = {
  pathSegments: readonly string[];
  entry: RouteInventoryEntry;
};

const ROUTE_TEMPLATES: readonly RouteTemplate[] = ROUTE_INVENTORY.map(
  (entry) => ({
    pathSegments: entry.filePath
      .replace(/\/route\.ts$/, "")
      .split("/")
      .filter(Boolean),
    entry,
  }),
).sort((left, right) => right.pathSegments.length - left.pathSegments.length);

function routeId(entry: RouteInventoryEntry, method: RoutePerformanceMethod) {
  const base = entry.filePath
    .replace(/\/route\.ts$/, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[^A-Za-z0-9_]+/g, ".")
    .replace(/_/g, "-")
    .toLowerCase();
  return `${base}.${method.toLowerCase()}`;
}

function pathMatchesTemplate(
  pathnameSegments: readonly string[],
  template: readonly string[],
): boolean {
  return (
    pathnameSegments.length === template.length &&
    template.every(
      (segment, index) =>
        /^\[[^\]]+\]$/.test(segment) || segment === pathnameSegments[index],
    )
  );
}

function documentRouteId(pathname: string): string {
  if (pathname === "/") return "document.home";
  if (pathname.startsWith("/country/")) return "document.country";
  if (pathname.startsWith("/governance-evidence/"))
    return "document.governance-evidence";
  if (pathname.startsWith("/civica-index")) return "document.civica-index";
  if (pathname.startsWith("/methodology")) return "document.methodology";
  if (pathname.startsWith("/constitution")) return "document.constitution";
  if (pathname.startsWith("/elections")) return "document.elections";
  if (pathname.startsWith("/organizations")) return "document.organizations";
  if (pathname.startsWith("/rankings")) return "document.rankings";
  if (pathname.startsWith("/compare")) return "document.compare";
  if (pathname.startsWith("/atlas")) return "document.atlas";
  if (pathname.startsWith("/admin")) return "document.admin";
  return "document.other";
}

function cacheProfileFor(
  entry: RouteInventoryEntry,
  method: RoutePerformanceMethod,
): TelemetryCacheProfile {
  const match = ROUTE_FRESHNESS_POLICY.find(
    (policy) => policy.filePath === entry.filePath && policy.method === method,
  );
  return match?.profileId ?? null;
}

/**
 * Convert a live URL into a closed route-template ID. Query strings and
 * dynamic path values are deliberately discarded before telemetry is created.
 */
export function classifyRoutePerformanceRequest(
  pathname: string,
  requestMethod: string,
): {
  routeId: string;
  method: RoutePerformanceMethod;
  cacheProfile: TelemetryCacheProfile;
} {
  const normalizedPath = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  const segments = normalizedPath.split("/").filter(Boolean);
  const method = requestMethod.toUpperCase() as RoutePerformanceMethod;
  const entry = ROUTE_TEMPLATES.find(({ pathSegments }) =>
    pathMatchesTemplate(segments, pathSegments),
  );

  if (entry) {
    const resolvedMethod = entry.entry.methods.includes(method as HttpMethod)
      ? method
      : "UNKNOWN";
    return {
      routeId: routeId(entry.entry, resolvedMethod),
      method: resolvedMethod,
      cacheProfile: cacheProfileFor(entry.entry, resolvedMethod),
    };
  }

  if (
    normalizedPath.startsWith("/api/") ||
    normalizedPath.startsWith("/downloads/")
  ) {
    return {
      routeId: "api.unknown",
      method: VALID_METHODS.has(method) ? method : "UNKNOWN",
      cacheProfile: null,
    };
  }

  return {
    routeId: documentRouteId(normalizedPath),
    method: "DOCUMENT",
    cacheProfile: "document",
  };
}

export function deploymentReleaseId(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidate =
    env.VERCEL_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? env.VERCEL_DEPLOYMENT_ID;
  if (candidate && /^[A-Za-z0-9._-]{7,96}$/.test(candidate)) return candidate;
  return env.NODE_ENV === "production" ? "production-unknown" : "local";
}

function boundedDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs)) return MAX_DURATION_MS;
  return Math.max(0, Math.min(MAX_DURATION_MS, Math.round(durationMs)));
}

function currentObservationBase() {
  return {
    releaseId: deploymentReleaseId(),
    telemetryVersion: ROUTE_PERFORMANCE_TELEMETRY_VERSION,
  };
}

export function requestPerformanceObservation(
  pathname: string,
  method: string,
  durationMs: number,
): RoutePerformanceObservation {
  const classified = classifyRoutePerformanceRequest(pathname, method);
  return {
    ...currentObservationBase(),
    ...classified,
    surface: "request",
    metric: "request_duration_ms",
    durationMs: boundedDuration(durationMs),
    httpStatus: null,
  };
}

/**
 * Decide whether one request contributes a stored observation. The random
 * source is injected so the decision is exercisable without stubbing globals,
 * and an unusable draw fails closed rather than becoming a write.
 */
export function shouldRecordRequestPerformanceSample(
  random: () => number = Math.random,
): boolean {
  const rate = ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE;
  if (!Number.isFinite(rate) || rate <= 0) return false;
  if (rate >= 1) return true;
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) return false;
  return draw < rate;
}

/**
 * Scale a sampled request count back to the request volume it represents.
 * Server errors are never sampled, so any comparison between an error count
 * and a request count has to pass through this correction.
 */
export function estimatedRequestPopulation(sampledCount: number): number {
  if (!Number.isFinite(sampledCount) || sampledCount <= 0) return 0;
  return Math.round(sampledCount / ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE);
}

export function jobPerformanceObservation(
  jobId: string,
  method: string,
  durationMs: number,
  httpStatus: number | null,
): RoutePerformanceObservation {
  return {
    ...currentObservationBase(),
    routeId: `job.${jobId.replace(/[^A-Za-z0-9_-]+/g, ".").toLowerCase()}`,
    method: VALID_METHODS.has(method.toUpperCase() as RoutePerformanceMethod)
      ? (method.toUpperCase() as RoutePerformanceMethod)
      : "UNKNOWN",
    surface: "job",
    metric: "job_duration_ms",
    durationMs: boundedDuration(durationMs),
    httpStatus,
    cacheProfile: "private-live",
  };
}

export function serverErrorObservation(
  pathname: string,
  method: string,
): RoutePerformanceObservation {
  const classified = classifyRoutePerformanceRequest(pathname, method);
  return {
    ...currentObservationBase(),
    ...classified,
    surface: "error",
    metric: "server_error",
    durationMs: null,
    httpStatus: 500,
  };
}

export function routePerformanceObservationErrors(
  observation: RoutePerformanceObservation,
): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9._-]{0,159}$/.test(observation.routeId))
    errors.push("route ID is not a closed template identifier");
  if (!VALID_METHODS.has(observation.method)) errors.push("method is invalid");
  if (!VALID_CACHE_PROFILES.has(observation.cacheProfile))
    errors.push("cache profile is invalid");
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(observation.releaseId))
    errors.push("release ID is invalid");
  if (observation.telemetryVersion !== ROUTE_PERFORMANCE_TELEMETRY_VERSION)
    errors.push("telemetry version drifted");
  if (observation.surface === "error") {
    if (
      observation.metric !== "server_error" ||
      observation.durationMs !== null
    )
      errors.push("error telemetry must not contain a duration");
  } else if (
    observation.metric !==
    (observation.surface === "job" ? "job_duration_ms" : "request_duration_ms")
  ) {
    errors.push("surface and metric do not agree");
  } else if (
    observation.durationMs === null ||
    observation.durationMs < 0 ||
    observation.durationMs > MAX_DURATION_MS
  ) {
    errors.push("duration is outside the bounded range");
  }
  if (
    observation.httpStatus !== null &&
    (observation.httpStatus < 100 || observation.httpStatus > 599)
  )
    errors.push("HTTP status is outside the valid range");
  return errors;
}

export const postgresRoutePerformanceStore: RoutePerformanceStore = {
  async insert(observation) {
    await db.insert(routePerformanceObservations).values({
      routeId: observation.routeId,
      method: observation.method,
      surface: observation.surface,
      metric: observation.metric,
      durationMs: observation.durationMs,
      httpStatus: observation.httpStatus,
      cacheProfile: observation.cacheProfile,
      releaseId: observation.releaseId,
      telemetryVersion: observation.telemetryVersion,
    });
  },
  async pruneBefore(before) {
    const result = await db
      .delete(routePerformanceObservations)
      .where(lt(routePerformanceObservations.observedAt, before))
      .returning({ id: routePerformanceObservations.id });
    return result.length;
  },
};

/**
 * A telemetry write is always best effort. Its failure is deliberately
 * reduced to a fixed log line and can never reject a reader request.
 */
export async function recordRoutePerformanceObservation(
  observation: RoutePerformanceObservation,
  store: RoutePerformanceStore = postgresRoutePerformanceStore,
): Promise<boolean> {
  if (routePerformanceObservationErrors(observation).length > 0) {
    console.error("[route-performance] telemetry_input_rejected");
    return false;
  }
  try {
    await store.insert(observation);
    return true;
  } catch {
    console.error("[route-performance] telemetry_write_failed");
    return false;
  }
}

export function scheduleRoutePerformanceObservation(
  observation: RoutePerformanceObservation,
): void {
  if (process.env.NODE_ENV !== "production") return;
  try {
    after(async () => {
      await recordRoutePerformanceObservation(observation);
    });
  } catch {
    // Outside a Next request context (for example a narrow unit fixture), do
    // not convert telemetry into a response dependency.
    void recordRoutePerformanceObservation(observation);
  }
}

export async function pruneRoutePerformanceObservations(
  store: RoutePerformanceStore = postgresRoutePerformanceStore,
  now: Date = new Date(),
): Promise<number> {
  const before = new Date(
    now.getTime() - ROUTE_PERFORMANCE_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  );
  try {
    return await store.pruneBefore(before);
  } catch {
    console.error("[route-performance] telemetry_prune_failed");
    return 0;
  }
}

export function scheduleRoutePerformancePrune(): void {
  if (process.env.NODE_ENV !== "production") return;
  try {
    after(async () => {
      await pruneRoutePerformanceObservations();
    });
  } catch {
    void pruneRoutePerformanceObservations();
  }
}

export async function loadRoutePerformanceSummaries(
  now: Date = new Date(),
  windowHours: number = ROUTE_PERFORMANCE_WINDOW_HOURS,
): Promise<RoutePerformanceSummary[]> {
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1_000);
  const result = await db.execute(sql`
    SELECT
      route_id,
      method,
      surface,
      metric,
      cache_profile,
      release_id,
      count(*)::int AS sample_count,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)
        FILTER (WHERE duration_ms IS NOT NULL) AS p95_ms,
      avg(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS average_ms
    FROM route_performance_observations
    WHERE observed_at >= ${since}
    GROUP BY route_id, method, surface, metric, cache_profile, release_id
    ORDER BY route_id, metric, release_id
  `);
  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    routeId: String(row.route_id),
    method: String(row.method) as RoutePerformanceMethod,
    surface: String(row.surface) as RoutePerformanceSurface,
    metric: String(row.metric) as RoutePerformanceMetric,
    cacheProfile:
      row.cache_profile === null
        ? null
        : (String(row.cache_profile) as TelemetryCacheProfile),
    releaseId: String(row.release_id),
    sampleCount: Number(row.sample_count),
    p95Ms: row.p95_ms === null ? null : Number(row.p95_ms),
    averageMs: row.average_ms === null ? null : Number(row.average_ms),
  }));
}

export function routePerformanceAlerts(
  summaries: readonly RoutePerformanceSummary[],
): RoutePerformanceAlert[] {
  const alerts: RoutePerformanceAlert[] = [];
  const requests = new Map<string, number>();
  const errors = new Map<string, RoutePerformanceSummary>();
  const alertKey = (summary: RoutePerformanceSummary) =>
    JSON.stringify([
      summary.routeId,
      summary.method,
      summary.cacheProfile,
      summary.releaseId,
    ]);
  for (const summary of summaries) {
    const key = alertKey(summary);
    if (summary.metric === "request_duration_ms") {
      requests.set(key, (requests.get(key) ?? 0) + summary.sampleCount);
      // This gate gauges how reliable the stored percentile is, so it counts
      // stored observations rather than estimated traffic. Under sampling a
      // route needs roughly 20/rate real requests in the window to qualify.
      if (summary.sampleCount >= 20 && (summary.p95Ms ?? 0) > 1_500) {
        alerts.push({
          id: "request_p95",
          routeId: summary.routeId,
          releaseId: summary.releaseId,
          cacheProfile: summary.cacheProfile,
          detail: `p95 ${Math.round(summary.p95Ms!)}ms exceeds the 1500ms threshold across ${summary.sampleCount} samples`,
        });
      }
    }
    if (
      summary.metric === "job_duration_ms" &&
      summary.sampleCount >= 4 &&
      (summary.p95Ms ?? 0) > 300_000
    ) {
      alerts.push({
        id: "job_p95",
        routeId: summary.routeId,
        releaseId: summary.releaseId,
        cacheProfile: summary.cacheProfile,
        detail: `p95 ${Math.round(summary.p95Ms!)}ms exceeds the 300000ms threshold across ${summary.sampleCount} samples`,
      });
    }
    if (summary.metric === "server_error") {
      const existing = errors.get(key);
      errors.set(
        key,
        existing
          ? {
              ...existing,
              sampleCount: existing.sampleCount + summary.sampleCount,
            }
          : summary,
      );
    }
  }
  for (const [key, errorSummary] of errors) {
    // Stored request rows are a uniform sample and stored error rows are not,
    // so the denominator is restored to its estimated population before the
    // rate is compared. Without this the ratio would be inflated by 1/rate.
    const requestCount = estimatedRequestPopulation(requests.get(key) ?? 0);
    if (requestCount >= 100 && errorSummary.sampleCount / requestCount > 0.02) {
      alerts.push({
        id: "server_error_rate",
        routeId: errorSummary.routeId,
        releaseId: errorSummary.releaseId,
        cacheProfile: errorSummary.cacheProfile,
        detail: `${errorSummary.sampleCount}/${requestCount} server errors exceed the 2% threshold (requests estimated from a ${ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE} sample)`,
      });
    }
  }
  return alerts;
}
