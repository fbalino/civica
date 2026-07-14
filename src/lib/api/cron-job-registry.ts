import vercelConfig from "../../../vercel.json";

import { SCHEDULED_PRODUCTION_ADAPTERS } from "@/lib/data/production-adapter-registry";

/**
 * A lease outlives the longest declared cron route by at least ten minutes.
 * Vercel can terminate a function at maxDuration; an abandoned lease then
 * becomes retryable without requiring a session-bound database connection.
 */
export const CRON_JOB_LEASE_MS = 30 * 60 * 1_000;

export interface CronJobDefinition {
  id: string;
  route: string;
  schedule: string | null;
  retired: boolean;
}

const schedules = new Map<string, string>();
for (const cron of vercelConfig.crons) {
  if (schedules.has(cron.path)) {
    throw new Error(`Duplicate Vercel cron route: ${cron.path}`);
  }
  schedules.set(cron.path, cron.schedule);
}

const scheduledJobs: CronJobDefinition[] = SCHEDULED_PRODUCTION_ADAPTERS.map(
  (adapter) => {
    const schedule = schedules.get(adapter.route);
    if (!schedule) {
      throw new Error(
        `Scheduled production adapter ${adapter.id} is absent from vercel.json`,
      );
    }
    return {
      id: adapter.id,
      route: adapter.route,
      schedule,
      retired: false,
    };
  },
);

const registeredScheduledRoutes = new Set(
  scheduledJobs.map(({ route }) => route),
);
for (const route of schedules.keys()) {
  if (!registeredScheduledRoutes.has(route)) {
    throw new Error(
      `Vercel cron route is absent from the adapter registry: ${route}`,
    );
  }
}

const retiredJobs: CronJobDefinition[] = [
  {
    id: "pulse.v1.ingest",
    route: "/api/cron/pulse/ingest",
    schedule: null,
    retired: true,
  },
  {
    id: "pulse.v1.classify",
    route: "/api/cron/pulse/classify",
    schedule: null,
    retired: true,
  },
  {
    id: "pulse.v1.calculate",
    route: "/api/cron/pulse/calculate",
    schedule: null,
    retired: true,
  },
];

export const CRON_JOB_DEFINITIONS: readonly CronJobDefinition[] = [
  ...scheduledJobs,
  ...retiredJobs,
];

const definitionsById = new Map<string, CronJobDefinition>();
const definitionsByRoute = new Map<string, CronJobDefinition>();
for (const definition of CRON_JOB_DEFINITIONS) {
  if (definitionsById.has(definition.id)) {
    throw new Error(`Duplicate cron job id: ${definition.id}`);
  }
  if (definitionsByRoute.has(definition.route)) {
    throw new Error(`Duplicate cron job route: ${definition.route}`);
  }
  definitionsById.set(definition.id, definition);
  definitionsByRoute.set(definition.route, definition);
}

export function getCronJobDefinition(jobId: string): CronJobDefinition {
  const definition = definitionsById.get(jobId);
  if (!definition) throw new Error(`Unknown cron job id: ${jobId}`);
  return definition;
}

export function getCronJobDefinitionByRoute(
  route: string,
): CronJobDefinition | null {
  return definitionsByRoute.get(route) ?? null;
}
