import {
  PUBLIC_DISPUTE_STATUS_BUCKETS,
  type AgeBucket,
  type DisputeSortKey,
  type PublicDisputeStatusBucket,
} from "@/lib/db/queries-data-disputes";
import {
  SEVERITY_BUCKETS,
  type SeverityBucket,
} from "@/lib/factbook/reconcile/dispute-severity";

/** One reader page contains at most this many consolidated fact conflicts. */
export const DISPUTES_PAGE_SIZE = 50;
/** Initial document/RSC payload budget for one public dispute page. */
export const DISPUTES_RESPONSE_BUDGET_BYTES = 1024 * 1024;

export interface PublicDisputesPageQuery {
  status?: PublicDisputeStatusBucket;
  kind?: string;
  factKey?: string;
  severity?: SeverityBucket;
  group?: string;
  sourcePair?: string;
  age?: AgeBucket;
  sort: DisputeSortKey;
  page: number;
}

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;

const PAGE_NUMBER = /^[1-9][0-9]*$/;
const SAFE_IDENTIFIER = /^[a-z0-9_]+$/;
const SOURCE_PAIR = /^(?:[a-z0-9_]+)?\|(?:[a-z0-9_]+)?$/;
const MAX_PAGE = 40_000;
const AGE_BUCKETS: readonly AgeBucket[] = ["0-7d", "7-30d", "30-90d", "90d+"];
const FACT_GROUPS = ["A", "B", "C"] as const;
const SORTS: readonly DisputeSortKey[] = ["severity", "age", "oldest"];

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function includes<T extends string>(values: readonly T[], value: string | undefined): value is T {
  return Boolean(value && values.includes(value as T));
}

/** Parse only safe, supported public filters; malformed URLs fail closed. */
export function parsePublicDisputesPageQuery(
  searchParams: SearchParamRecord,
): PublicDisputesPageQuery {
  const rawPage = first(searchParams.page);
  const parsedPage =
    rawPage && PAGE_NUMBER.test(rawPage) ? Number(rawPage) : Number.NaN;
  const status = first(searchParams.status);
  const kind = first(searchParams.kind);
  const factKey = first(searchParams.factKey);
  const severity = first(searchParams.severity);
  const group = first(searchParams.group);
  const sourcePair = first(searchParams.sourcePair);
  const age = first(searchParams.age);
  const sort = first(searchParams.sort);

  const query: PublicDisputesPageQuery = {
    sort: includes(SORTS, sort) ? sort : "severity",
    page:
      Number.isSafeInteger(parsedPage) && parsedPage <= MAX_PAGE
        ? parsedPage
        : 1,
  };
  if (includes(PUBLIC_DISPUTE_STATUS_BUCKETS, status)) query.status = status;
  if (kind && SAFE_IDENTIFIER.test(kind)) query.kind = kind;
  if (factKey && SAFE_IDENTIFIER.test(factKey)) query.factKey = factKey;
  if (includes(SEVERITY_BUCKETS, severity)) query.severity = severity;
  if (includes(FACT_GROUPS, group)) query.group = group;
  if (sourcePair && SOURCE_PAIR.test(sourcePair) && sourcePair !== "|") {
    query.sourcePair = sourcePair;
  }
  if (includes(AGE_BUCKETS, age)) query.age = age;
  return query;
}

export function publicDisputesPageOffset(
  query: PublicDisputesPageQuery,
): number {
  return (query.page - 1) * DISPUTES_PAGE_SIZE;
}

/** Create canonical, shareable filter URLs without empty/default values. */
export function publicDisputesSearch(query: PublicDisputesPageQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.kind) params.set("kind", query.kind);
  if (query.factKey) params.set("factKey", query.factKey);
  if (query.severity) params.set("severity", query.severity);
  if (query.group) params.set("group", query.group);
  if (query.sourcePair) params.set("sourcePair", query.sourcePair);
  if (query.age) params.set("age", query.age);
  if (query.sort !== "severity") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * The server may serialize only a single page of consolidated conflicts.
 * Guard against a future query regression turning the RSC payload back into a
 * full dispute feed.
 */
export function requireBoundedPublicDisputePage<Group>(
  groups: readonly Group[],
): readonly Group[] {
  if (groups.length > DISPUTES_PAGE_SIZE) {
    throw new Error(
      "Public dispute result boundary violated; refuse to serialize an oversized response.",
    );
  }
  return groups;
}
