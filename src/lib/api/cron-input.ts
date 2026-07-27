import { parseAtlasVintageLabel } from "@/lib/data/frozen-vintage";

const BOOLEAN_FLAG = new Set(["1"]);
const VERIFY_METRIC_IDS = new Set([
  "active_sources",
  "multi_sourced_two",
  "multi_sourced_three",
  "total_facts",
  "wikidata_freshness_retrieved",
  "wikidata_zero_globally",
  "nso_sync_status",
  "nso_sync_freshness",
  "tier1_sync_status",
  "tier1_sync_freshness",
  "vintage_label_format",
  "vintage_freshness",
  "methodology_version_consistency",
  "open_disputes_bottleneck",
]);

type QueryValidator = (value: string) => boolean;

interface CronInputSchema {
  query: Readonly<Record<string, QueryValidator>>;
  validateTogether?: (params: URLSearchParams) => boolean;
}

export type CronInputProblem =
  | "body_not_allowed"
  | "duplicate_query_parameter"
  | "invalid_query_parameter"
  | "unknown_query_parameter";

export type CronInputResult =
  { ok: true } | { ok: false; problem: CronInputProblem };

const dryRun: QueryValidator = (value) => BOOLEAN_FLAG.has(value);

const DEFAULT_SCHEMA: CronInputSchema = {
  query: { dryRun },
};

const SPECIAL_SCHEMAS: Readonly<Record<string, CronInputSchema>> = {
  "factbook.auto-resolve": {
    query: {
      dryRun,
      limit: (value) => {
        if (!/^[1-9]\d{0,3}$/.test(value)) return false;
        const parsed = Number(value);
        return parsed >= 1 && parsed <= 1_000;
      },
    },
  },
  "factbook.snapshot-vintage": {
    query: {
      dryRun,
      vintageLabel: (value) => {
        if (value.length > 120) return false;
        try {
          parseAtlasVintageLabel(value);
          return true;
        } catch {
          return false;
        }
      },
      cutAt: (value) =>
        value.length <= 40 &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          value,
        ) &&
        Number.isFinite(Date.parse(value)),
    },
    validateTogether: (params) =>
      params.has("vintageLabel") === params.has("cutAt"),
  },
  "factbook.cia-cabinets": {
    query: {
      dryRun,
      shard: (value) => /^(?:[0-9]|1[0-9]|2[0-7])$/.test(value),
    },
  },
  "factbook.verify-reconciliation": {
    query: {
      dryRun,
      verbose: (value) => BOOLEAN_FLAG.has(value),
      metric: (value) => VERIFY_METRIC_IDS.has(value),
    },
  },
};

const RETIRED_JOB_IDS = new Set([
  "pulse.v1.ingest",
  "pulse.v1.classify",
  "pulse.v1.calculate",
]);

/**
 * Validate the complete application-controlled input to a cron route. This is
 * called only after the shared secret and route registry checks, and before
 * idempotency scope, lease acquisition, database access, or handler work.
 */
export function validateCronInput(
  jobId: string,
  request: Request,
): CronInputResult {
  if (
    request.body !== null ||
    (request.headers.get("content-length") !== null &&
      request.headers.get("content-length") !== "0") ||
    request.headers.has("transfer-encoding")
  ) {
    return { ok: false, problem: "body_not_allowed" };
  }

  const params = new URL(request.url).searchParams;
  const schema = RETIRED_JOB_IDS.has(jobId)
    ? ({ query: {} } satisfies CronInputSchema)
    : (SPECIAL_SCHEMAS[jobId] ?? DEFAULT_SCHEMA);

  for (const key of new Set(params.keys())) {
    const validator = schema.query[key];
    if (!validator) {
      return { ok: false, problem: "unknown_query_parameter" };
    }
    const values = params.getAll(key);
    if (values.length !== 1) {
      return { ok: false, problem: "duplicate_query_parameter" };
    }
    if (!validator(values[0])) {
      return { ok: false, problem: "invalid_query_parameter" };
    }
  }

  if (schema.validateTogether && !schema.validateTogether(params)) {
    return { ok: false, problem: "invalid_query_parameter" };
  }

  return { ok: true };
}
