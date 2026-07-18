import { z } from "zod";

import { apiProblem } from "@/lib/api/problem";
import { CI_RELEASE_QUERY_IDENTITIES } from "@/lib/ci/release-query-identities";
import { JURISDICTION_STATUS_TYPES } from "@/lib/jurisdictions/status-taxonomy";

const MAX_RAW_QUERY_BYTES = 16_384;
const MAX_QUERY_PAIRS = 64;
const MAX_QUERY_KEY_LENGTH = 128;
const MAX_QUERY_VALUE_LENGTH = 8_192;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const CANONICAL_UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOPIC_KEY = /^[A-Za-z0-9_-]+$/;
const QUARTER = /^(?:19|20)\d{2}-Q[1-4]$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
const ATLAS_VINTAGE =
  /^Civica Atlas Reconciled v[^\s]+ — vintage \d{4}-Q[1-4]$/;

const CI_RELEASE_IDS = new Set(
  CI_RELEASE_QUERY_IDENTITIES.map((release) => release.releaseId),
);
const CI_METHODOLOGY_VERSIONS = new Set(
  CI_RELEASE_QUERY_IDENTITIES.map((release) => release.methodologyVersion),
);
const CURRENT_CI_RELEASE = CI_RELEASE_QUERY_IDENTITIES.at(-1)!;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;
const withoutNullByte = (value: string) => !value.includes("\0");
const text = (max: number, min = 0) =>
  z.string().min(min).max(max).refine(withoutNullByte);
const optionalText = (max: number, min = 0) => text(max, min).optional();
const slug = text(100, 1).regex(SLUG);
const topicKey = text(80, 1).regex(TOPIC_KEY);
const quarter = z.string().regex(QUARTER);
const taxonomy = z.enum(["raw", "structural", "regime"]);
const extendedTaxonomy = z.enum([
  "raw",
  "structural",
  "regime",
  "region",
  "income",
  "vdem",
  "cgv",
  "monarchy",
]);

function canonicalInteger(min: number, max: number, fallback?: number) {
  const parsed = z
    .string()
    .regex(CANONICAL_UNSIGNED_INTEGER)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
  return fallback === undefined
    ? parsed
    : z.preprocess(
        (value) => (value === undefined ? String(fallback) : value),
        parsed,
      );
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

const dateOnly = z.string().refine(isCalendarDate);
const atlasSelection = z.union([
  z.literal("live"),
  text(120, 1).regex(ATLAS_VINTAGE),
]);
const ciRelease = text(80, 1).refine((value) => CI_RELEASE_IDS.has(value));
const ciMethodology = text(80, 1).refine((value) =>
  CI_METHODOLOGY_VERSIONS.has(value),
);
const defaultCiRelease = z.preprocess(
  (value) => value ?? CURRENT_CI_RELEASE.releaseId,
  ciRelease,
);
const ciMethodologyReleaseQuery = z
  .object({
    release: ciRelease.optional(),
    version: ciMethodology.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const matches = value.version
      ? CI_RELEASE_QUERY_IDENTITIES.filter(
          (release) => release.methodologyVersion === value.version,
        )
      : [];
    if (value.version && !value.release && matches.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["version"],
        message: "methodology version is ambiguous; select an exact release",
      });
    }
    if (value.version && value.release) {
      const release = CI_RELEASE_QUERY_IDENTITIES.find(
        (candidate) => candidate.releaseId === value.release,
      );
      if (release?.methodologyVersion !== value.version) {
        ctx.addIssue({
          code: "custom",
          path: ["version"],
          message: "methodology version does not match the selected release",
        });
      }
    }
  });

function uniqueArray<Item extends z.ZodType>(item: Item, max: number) {
  return z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length);
}

const boundedCommaList = text(4_096, 1)
  .transform((value) => value.split(",").map((item) => item.trim()))
  .pipe(
    uniqueArray(
      text(160, 1).refine((value) => !value.includes(",")),
      32,
    ),
  );

const adminAdvisoryQueueSchema = z
  .object({
    limit: canonicalInteger(1, 200, 50),
    offset: canonicalInteger(0, 1_000_000, 0),
    status: z.enum(["new", "reviewed", "contacted", "archived"]).optional(),
  })
  .strict();

const adminContactQueueSchema = z
  .object({
    limit: canonicalInteger(1, 200, 50),
    offset: canonicalInteger(0, 1_000_000, 0),
  })
  .strict();

const oauthCallbackSchema = z
  .object({
    code: optionalText(4_096, 1),
    state: text(48)
      .regex(/^[a-f0-9]{48}$/)
      .optional(),
    error: optionalText(256, 1),
    error_description: optionalText(1_024),
    error_uri: optionalText(2_048, 1),
    scope: optionalText(2_048),
    authuser: canonicalInteger(0, 100).optional(),
    prompt: optionalText(100),
    hd: optionalText(253),
  })
  .strict();

const constitutionSearchSchema = z
  .object({
    q: text(512, 1)
      .transform((value) => value.trim())
      .pipe(text(512, 2).refine((value) => utf8Length(value) <= 256)),
    jurisdiction: uniqueArray(slug, 20).default([]),
    topic: uniqueArray(topicKey, 10).default([]),
    language: z.literal("en").default("en"),
    limit: canonicalInteger(1, 50, 20),
    cursor: optionalText(2_048, 1),
  })
  .strict();

const electionsQuerySchema = z
  .object({
    format: z.enum(["json", "csv"]).default("json"),
    jurisdiction: text(100, 1)
      .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)
      .optional(),
    type: z.enum(["legislative", "presidential"]).optional(),
    temporal_class: z
      .enum(["historical", "source_dated_upcoming", "projection_due"])
      .optional(),
    source_status: z
      .enum(["held", "source_dated", "tentative", "unknown"])
      .optional(),
    jurisdiction_status: z.enum(JURISDICTION_STATUS_TYPES).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    has_results: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    has_turnout: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to);

const pulseDimensions = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
  "stability",
] as const;
const pulseSeverities = [
  "low_pos",
  "moderate_pos",
  "high_pos",
  "low_neg",
  "moderate_neg",
  "severe_neg",
  "catastrophic_neg",
] as const;

interface QueryContractDefinition<Schema extends z.ZodType = z.ZodType> {
  schema: Schema;
  repeatableKeys: readonly string[];
}

export const QUERY_CONTRACT_SCHEMAS = {
  "admin-advisory-queue-query/v1": {
    schema: adminAdvisoryQueueSchema,
    repeatableKeys: [],
  },
  "admin-contact-queue-query/v1": {
    schema: adminContactQueueSchema,
    repeatableKeys: [],
  },
  "oauth-callback-query/v1": {
    schema: oauthCallbackSchema,
    repeatableKeys: [],
  },
  "oauth-start-query/v1": {
    schema: z.object({ redirect: optionalText(2_048) }).strict(),
    repeatableKeys: [],
  },
  "constitution-notable-query/v1": {
    schema: z.object({ topic: topicKey, exclude: slug.optional() }).strict(),
    repeatableKeys: [],
  },
  "constitution-excerpts-query/v1": {
    schema: z
      .object({ topic: topicKey, c: uniqueArray(slug, 4).default([]) })
      .strict(),
    repeatableKeys: ["c"],
  },
  "constitution-search-query/v1": {
    schema: constitutionSearchSchema,
    repeatableKeys: ["jurisdiction", "topic"],
  },
  "country-export-query/v1": {
    schema: z
      .object({
        format: z.enum(["json", "csv"]).default("json"),
        as_of: atlasSelection,
      })
      .strict(),
    repeatableKeys: [],
  },
  "indicator-history-query/v1": {
    schema: z
      .object({
        format: z.enum(["json", "csv"]).default("json"),
        indicator: text(200, 1).regex(IDENTIFIER).optional(),
      })
      .strict(),
    repeatableKeys: [],
  },
  "governance-evidence-query/v1": {
    schema: z
      .object({
        series_type: z
          .enum([
            "as_published_release",
            "harmonized_backcast",
            "current_harmonized_backcast_not_as_published",
          ])
          .optional(),
      })
      .strict(),
    repeatableKeys: [],
  },
  "metric-strip-query/v1": {
    schema: z
      .object({
        year: canonicalInteger(1800, 2200),
        govTypes: boundedCommaList.optional(),
        regions: boundedCommaList.optional(),
        taxonomy: taxonomy.default("raw"),
        country: slug.optional(),
      })
      .strict(),
    repeatableKeys: [],
  },
  "v1-country-detail-query/v1": {
    schema: z.object({ as_of: atlasSelection }).strict(),
    repeatableKeys: [],
  },
  "v1-countries-query/v1": {
    schema: z
      .object({
        as_of: atlasSelection,
        continent: optionalText(100, 1),
        government_type: optionalText(200, 1),
        taxonomy: extendedTaxonomy.default("raw"),
        limit: canonicalInteger(1, 250, 50),
        offset: canonicalInteger(0, 1_000_000, 0),
        status: z.enum(JURISDICTION_STATUS_TYPES).optional(),
      })
      .strict(),
    repeatableKeys: [],
  },
  "v1-elections-query/v1": {
    schema: electionsQuerySchema,
    repeatableKeys: [],
  },
  "v1-conditions-query/v1": {
    schema: z
      .object({
        release: text(120, 1)
          .regex(/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/)
          .optional(),
      })
      .strict(),
    repeatableKeys: [],
  },
  "v1-index-history-query/v1": {
    schema: z.object({ release: defaultCiRelease }).strict(),
    repeatableKeys: [],
  },
  "v1-index-country-query/v1": {
    schema: z.object({ release: defaultCiRelease }).strict(),
    repeatableKeys: [],
  },
  "v1-index-group-query/v1": {
    schema: z
      .object({
        quarter: quarter.optional(),
        taxonomy: taxonomy.default("raw"),
        release: defaultCiRelease,
      })
      .strict(),
    repeatableKeys: [],
  },
  "v1-index-compare-query/v1": {
    schema: z
      .object({
        slug: uniqueArray(slug, 10).min(1),
        quarter: quarter.optional(),
        release: defaultCiRelease,
      })
      .strict(),
    repeatableKeys: ["slug"],
  },
  "v1-index-methodology-query/v1": {
    schema: ciMethodologyReleaseQuery,
    repeatableKeys: [],
  },
  "v1-index-rankings-query/v1": {
    schema: z
      .object({
        sort: text(2, 2)
          .transform((value) => value.toLowerCase())
          .pipe(z.enum(["ci", "cp"]))
          .default("ci"),
        quarter: quarter.optional(),
        continent: optionalText(100, 1),
        government_type: optionalText(200, 1),
        taxonomy: extendedTaxonomy.default("raw"),
        limit: canonicalInteger(1, 250, 50),
        offset: canonicalInteger(0, 1_000_000, 0),
        release: defaultCiRelease,
      })
      .strict(),
    repeatableKeys: [],
  },
  "v1-pulse-changelog-query/v1": {
    schema: z
      .object({
        country: slug.optional(),
        dimension: z.enum(pulseDimensions).optional(),
        severity: z.enum(pulseSeverities).optional(),
        since: dateOnly.optional(),
        published_only: z
          .literal("1")
          .transform(() => true)
          .optional()
          .default(false),
        limit: canonicalInteger(1, 250, 50),
        offset: canonicalInteger(0, 1_000_000, 0),
      })
      .strict(),
    repeatableKeys: [],
  },
} as const satisfies Record<string, QueryContractDefinition>;

const entityTypes = [
  "fact",
  "institution",
  "office",
  "person",
  "election",
  "constitution-passage",
  "organization",
  "indicator",
] as const;

const entityCitationParamsSchema = z
  .object({
    entityType: z.enum(entityTypes),
    id: text(100, 1),
  })
  .strict()
  .superRefine((value, context) => {
    const valid =
      value.entityType === "constitution-passage"
        ? SHA256_DIGEST.test(value.id)
        : ANY_UUID.test(value.id);
    if (!valid) context.addIssue({ code: "custom", path: ["id"] });
  });

const jurisdictionSlugParamsSchema = z
  .union([
    z.object({ slug }).strict(),
    z.object({ country_slug: slug }).strict(),
  ])
  .transform((value) => ({
    slug: "slug" in value ? value.slug : value.country_slug,
  }));

export const PARAM_CONTRACT_SCHEMAS = {
  "entity-citation-params/v1": entityCitationParamsSchema,
  "constitution-passage-params/v1": z
    .object({ digest: z.string().regex(SHA256_DIGEST) })
    .strict(),
  "jurisdiction-slug-params/v1": jurisdictionSlugParamsSchema,
  "pulse-study-uuid-params/v1": z
    .object({ studyId: z.string().regex(UUID) })
    .strict(),
  "pulse-country-slug-params/v1": z.object({ country_slug: slug }).strict(),
  "embed-slug-params/v1": z.object({ slug }).strict(),
  "metric-id-params/v1": z
    .object({ metricId: text(80, 1).regex(IDENTIFIER) })
    .strict(),
  "v1-country-code-params/v1": z
    .object({
      code: text(100, 1)
        .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)
        .transform((value) => value.toLowerCase()),
    })
    .strict(),
} as const satisfies Record<string, z.ZodType>;

export type QueryContractSchemaId = keyof typeof QUERY_CONTRACT_SCHEMAS;
export type ParamContractSchemaId = keyof typeof PARAM_CONTRACT_SCHEMAS;

type QueryContractOutput<Id extends QueryContractSchemaId> = z.output<
  (typeof QUERY_CONTRACT_SCHEMAS)[Id]["schema"]
>;
type ParamContractOutput<Id extends ParamContractSchemaId> = z.output<
  (typeof PARAM_CONTRACT_SCHEMAS)[Id]
>;

export type RequestContractParseResult<T> =
  { ok: true; data: T } | { ok: false; response: Response };

export interface RequestContractParseOptions {
  errorHeaders?: HeadersInit;
}

function decodeQueryComponent(raw: string): string | null {
  if (/%(?![0-9a-fA-F]{2})/.test(raw)) return null;
  try {
    return decodeURIComponent(raw.replaceAll("+", " "));
  } catch {
    return null;
  }
}

function parseRawQuery(
  request: Request,
  repeatableKeys: readonly string[],
): Record<string, string | string[]> | null {
  let raw: string;
  try {
    raw = new URL(request.url).search.slice(1);
  } catch {
    return null;
  }
  if (utf8Length(raw) > MAX_RAW_QUERY_BYTES) return null;

  const output = Object.create(null) as Record<string, string | string[]>;
  if (raw === "") return output;
  const pairs = raw.split("&");
  if (pairs.length > MAX_QUERY_PAIRS || pairs.some((pair) => pair === "")) {
    return null;
  }
  const repeatable = new Set(repeatableKeys);

  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? "" : pair.slice(separator + 1);
    const key = decodeQueryComponent(rawKey);
    const value = decodeQueryComponent(rawValue);
    if (
      key === null ||
      value === null ||
      key.length === 0 ||
      key.length > MAX_QUERY_KEY_LENGTH ||
      value.length > MAX_QUERY_VALUE_LENGTH ||
      FORBIDDEN_KEYS.has(key)
    ) {
      return null;
    }

    if (Object.hasOwn(output, key)) {
      if (!repeatable.has(key)) return null;
      const existing = output[key];
      output[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      output[key] = repeatable.has(key) ? [value] : value;
    }
  }
  return output;
}

/**
 * Decode and validate one route's complete query contract. Unknown keys,
 * duplicate scalar keys, malformed escapes, and invalid values all share one
 * fixed no-store response; caller-controlled values are never reflected.
 */
export function parseQueryContract<Id extends QueryContractSchemaId>(
  request: Request,
  schemaId: Id,
  options: RequestContractParseOptions = {},
): RequestContractParseResult<QueryContractOutput<Id>> {
  const definition = QUERY_CONTRACT_SCHEMAS[schemaId];
  const raw = parseRawQuery(request, definition.repeatableKeys);
  if (raw === null)
    return {
      ok: false,
      response: apiProblem("INVALID_QUERY", { headers: options.errorHeaders }),
    };
  const parsed = definition.schema.safeParse(raw);
  return parsed.success
    ? {
        ok: true,
        data: parsed.data as QueryContractOutput<Id>,
      }
    : {
        ok: false,
        response: apiProblem("INVALID_QUERY", {
          headers: options.errorHeaders,
        }),
      };
}

/** Validate decoded Next.js path params before any database or expensive work. */
export async function parsePathContract<Id extends ParamContractSchemaId>(
  params:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>,
  schemaId: Id,
  options: RequestContractParseOptions = {},
): Promise<RequestContractParseResult<ParamContractOutput<Id>>> {
  let value: Record<string, string | string[] | undefined>;
  try {
    value = await params;
  } catch {
    return {
      ok: false,
      response: apiProblem("INVALID_PATH", { headers: options.errorHeaders }),
    };
  }
  const parsed = PARAM_CONTRACT_SCHEMAS[schemaId].safeParse(value);
  return parsed.success
    ? { ok: true, data: parsed.data as ParamContractOutput<Id> }
    : {
        ok: false,
        response: apiProblem("INVALID_PATH", {
          headers: options.errorHeaders,
        }),
      };
}
