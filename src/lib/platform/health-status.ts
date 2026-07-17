import { sql } from "drizzle-orm";

import {
  CRON_JOB_DEFINITIONS,
} from "@/lib/api/cron-job-registry";
import { latestCronScheduleSlot } from "@/lib/api/cron-schedule";
import { db } from "@/lib/db";
import { CIVICA_MAP_BASE_STYLE } from "@/lib/map/civica-map-style";
import {
  loadPipelineAlertRows,
  pipelineAlerts,
  type PipelineAlert,
  type PipelineAlertRow,
} from "@/lib/platform/pipeline-observability";

/**
 * Public, content-free availability contract. It intentionally reports
 * component states and closed reason codes, never exception text, URLs,
 * provider names, environment-variable names, or credentials.
 */
export const HEALTH_STATUS_VERSION = "civica-health-status/v1" as const;
export const HEALTH_ASSET_PROBE_TIMEOUT_MS = 5_000;

export type HealthState = "operational" | "degraded" | "unavailable";
export type HealthComponentId =
  | "application"
  | "database"
  | "critical_assets"
  | "scheduled_data_freshness"
  | "model_dependent_optional_services";

export type HealthComponentSummary =
  | "serving"
  | "available"
  | "unavailable"
  | "configured_asset_available"
  | "configured_asset_unavailable"
  | "freshness_current"
  | "freshness_alerts_open"
  | "freshness_unavailable"
  | "all_model_services_configured"
  | "ask_civica_unavailable"
  | "automated_classification_limited"
  | "model_services_unavailable";

export interface HealthComponent {
  id: HealthComponentId;
  state: HealthState;
  optional: boolean;
  summary: HealthComponentSummary;
}

export interface HealthStatusReport {
  version: typeof HEALTH_STATUS_VERSION;
  checkedAt: string;
  overall: HealthState;
  components: readonly HealthComponent[];
}

export type StatusPageComponent =
  | "website"
  | "atlas_data"
  | "atlas_map"
  | "ask_civica";

export interface StatusPageDecision {
  action: "observe" | "publish";
  incidentStatus: "investigating" | null;
  threshold:
    | "not_met"
    | "immediate_core_failure"
    | "two_consecutive_observations";
  components: readonly StatusPageComponent[];
}

export interface HealthStatusDependencies {
  now?: () => Date;
  env?: Readonly<Record<string, string | undefined>>;
  checkDatabase?: () => Promise<void>;
  probeCriticalAsset?: (url: string) => Promise<void>;
  loadPipelineRows?: (now: Date) => Promise<PipelineAlertRow[]>;
  expectedPipelineSlots?: (now: Date) => ReadonlyMap<string, Date>;
}

function isConfigured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function expectedPipelineSlots(now: Date): ReadonlyMap<string, Date> {
  return new Map(
    CRON_JOB_DEFINITIONS.filter(
      (definition) => !definition.retired && definition.schedule,
    ).map((definition) => [
      definition.id,
      latestCronScheduleSlot(definition.schedule!, now),
    ]),
  );
}

async function checkDatabase(): Promise<void> {
  await db.execute(sql`SELECT 1`);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A HEAD request is enough to prove the active map asset is reachable while
 * avoiding a PMTiles download. This is deliberately bounded and sends no
 * visitor data or credentials to the asset host.
 */
export async function probeCriticalAsset(url: string): Promise<void> {
  if (!isHttpsUrl(url)) throw new Error("critical asset URL is not HTTPS");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    HEALTH_ASSET_PROBE_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("critical asset probe failed");
  } finally {
    clearTimeout(timeout);
  }
}

function componentById(
  report: HealthStatusReport,
  id: HealthComponentId,
): HealthComponent {
  const component = report.components.find((candidate) => candidate.id === id);
  if (!component) throw new Error(`Health report omitted ${id}`);
  return component;
}

function overallHealth(components: readonly HealthComponent[]): HealthState {
  const application = components.find(({ id }) => id === "application");
  const database = components.find(({ id }) => id === "database");
  if (application?.state === "unavailable" || database?.state === "unavailable") {
    return "unavailable";
  }
  return components.some(
    (component) => !component.optional && component.state !== "operational",
  )
    ? "degraded"
    : "operational";
}

function modelServicesComponent(
  env: Readonly<Record<string, string | undefined>>,
): HealthComponent {
  const askCivica = isConfigured(env.ANTHROPIC_API_KEY_CHAT);
  const pulseProviderCount = [
    env.ANTHROPIC_API_KEY_PULSE_CLASSIFIER,
    env.DEEPSEEK_API_KEY,
    env.GLM_API_KEY,
  ].filter(isConfigured).length;

  if (askCivica && pulseProviderCount === 3) {
    return {
      id: "model_dependent_optional_services",
      state: "operational",
      optional: true,
      summary: "all_model_services_configured",
    };
  }
  if (!askCivica && pulseProviderCount === 0) {
    return {
      id: "model_dependent_optional_services",
      state: "unavailable",
      optional: true,
      summary: "model_services_unavailable",
    };
  }
  if (!askCivica) {
    return {
      id: "model_dependent_optional_services",
      state: "degraded",
      optional: true,
      summary: "ask_civica_unavailable",
    };
  }
  return {
    id: "model_dependent_optional_services",
    state: "degraded",
    optional: true,
    summary: "automated_classification_limited",
  };
}

function freshnessComponent(alerts: readonly PipelineAlert[]): HealthComponent {
  return alerts.length
    ? {
        id: "scheduled_data_freshness",
        state: "degraded",
        optional: false,
        summary: "freshness_alerts_open",
      }
    : {
        id: "scheduled_data_freshness",
        state: "operational",
        optional: false,
        summary: "freshness_current",
      };
}

/**
 * Run independent probes concurrently. A failed dependency is represented as
 * that component's closed state, so one bad check never hides the rest of the
 * report or leaks a provider exception through a public endpoint.
 */
export async function checkHealthStatus(
  dependencies: HealthStatusDependencies = {},
): Promise<HealthStatusReport> {
  const now = dependencies.now?.() ?? new Date();
  const env = dependencies.env ?? process.env;
  const databaseCheck = dependencies.checkDatabase ?? checkDatabase;
  const assetProbe = dependencies.probeCriticalAsset ?? probeCriticalAsset;
  const loadRows = dependencies.loadPipelineRows ?? loadPipelineAlertRows;
  const slotsFor = dependencies.expectedPipelineSlots ?? expectedPipelineSlots;
  const activeAsset = env.NEXT_PUBLIC_BASEMAP_PMTILES_URL?.trim() || CIVICA_MAP_BASE_STYLE;

  const [database, asset, freshness] = await Promise.all([
    databaseCheck().then(
      (): HealthComponent => ({
        id: "database",
        state: "operational",
        optional: false,
        summary: "available",
      }),
      (): HealthComponent => ({
        id: "database",
        state: "unavailable",
        optional: false,
        summary: "unavailable",
      }),
    ),
    assetProbe(activeAsset).then(
      (): HealthComponent => ({
        id: "critical_assets",
        state: "operational",
        optional: false,
        summary: "configured_asset_available",
      }),
      (): HealthComponent => ({
        id: "critical_assets",
        state: "unavailable",
        optional: false,
        summary: "configured_asset_unavailable",
      }),
    ),
    loadRows(now).then(
      (rows): HealthComponent =>
        freshnessComponent(
          pipelineAlerts({ now, expectedSlots: slotsFor(now), rows }),
        ),
      (): HealthComponent => ({
        id: "scheduled_data_freshness",
        state: "unavailable",
        optional: false,
        summary: "freshness_unavailable",
      }),
    ),
  ]);

  const components: readonly HealthComponent[] = [
    {
      id: "application",
      state: "operational",
      optional: false,
      summary: "serving",
    },
    database,
    asset,
    freshness,
    modelServicesComponent(env),
  ];
  return {
    version: HEALTH_STATUS_VERSION,
    checkedAt: now.toISOString(),
    overall: overallHealth(components),
    components,
  };
}

/**
 * Only an unavailable application or database returns a failing HTTP health
 * status. A map, freshness, or optional-model incident is still visible in
 * the body and monitor, while the website itself remains reachable.
 */
export function healthHttpStatus(report: HealthStatusReport): 200 | 503 {
  return componentById(report, "application").state === "unavailable" ||
    componentById(report, "database").state === "unavailable"
    ? 503
    : 200;
}

/**
 * Translate a health report into the manual Incident.io publish decision.
 * A core application/database failure publishes immediately. Other reader
 * impact must appear in two consecutive 15-minute monitor executions before
 * publication, avoiding an incident for a single transient probe failure.
 */
export function statusPageDecision(
  report: HealthStatusReport,
  consecutiveAdverseObservations = 1,
): StatusPageDecision {
  if (!Number.isSafeInteger(consecutiveAdverseObservations) || consecutiveAdverseObservations < 1) {
    throw new Error("consecutive adverse observations must be a positive integer");
  }
  const application = componentById(report, "application");
  const database = componentById(report, "database");
  if (application.state === "unavailable" || database.state === "unavailable") {
    return {
      action: "publish",
      incidentStatus: "investigating",
      threshold: "immediate_core_failure",
      components: ["website", "atlas_data"],
    };
  }

  const components = new Set<StatusPageComponent>();
  if (componentById(report, "critical_assets").state !== "operational") {
    components.add("atlas_map");
  }
  if (componentById(report, "scheduled_data_freshness").state !== "operational") {
    components.add("atlas_data");
  }
  const modelServices = componentById(
    report,
    "model_dependent_optional_services",
  );
  if (
    modelServices.summary === "ask_civica_unavailable" ||
    modelServices.summary === "model_services_unavailable"
  ) {
    components.add("ask_civica");
  }

  if (components.size > 0 && consecutiveAdverseObservations >= 2) {
    return {
      action: "publish",
      incidentStatus: "investigating",
      threshold: "two_consecutive_observations",
      components: [...components].sort(),
    };
  }
  return {
    action: "observe",
    incidentStatus: null,
    threshold: "not_met",
    components: [...components].sort(),
  };
}
