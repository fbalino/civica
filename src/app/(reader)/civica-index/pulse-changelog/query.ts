import {
  PULSE_DIMENSIONS,
  type PulseDimension,
} from "@/lib/pulse/v2/types";
import { SEVERITY_TIER_LABELS } from "@/lib/pulse/v2/labels";

/** The reader changelog sends one bounded result page to the client. */
export const PULSE_CHANGELOG_PAGE_SIZE = 25;
/** Initial document/RSC payload budget for a single reader changelog page. */
export const PULSE_CHANGELOG_RESPONSE_BUDGET_BYTES = 1024 * 1024;

export interface PulseChangelogPageQuery {
  country?: string;
  dimension?: PulseDimension;
  severity?: string;
  showReview: boolean;
  page: number;
}

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;

const COUNTRY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_NUMBER = /^[1-9][0-9]*$/;
const MAX_PAGE = 40_000;

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validDimension(value: string | undefined): value is PulseDimension {
  return Boolean(value && (PULSE_DIMENSIONS as readonly string[]).includes(value));
}

function validSeverity(value: string | undefined): value is string {
  return Boolean(value && Object.hasOwn(SEVERITY_TIER_LABELS, value));
}

export function parsePulseChangelogPageQuery(
  searchParams: SearchParamRecord,
): PulseChangelogPageQuery {
  const country = first(searchParams.country)?.toLowerCase();
  const dimension = first(searchParams.dimension);
  const severity = first(searchParams.severity);
  const rawPage = first(searchParams.page);
  const parsedPage =
    rawPage && PAGE_NUMBER.test(rawPage) ? Number(rawPage) : Number.NaN;

  const query: PulseChangelogPageQuery = {
    showReview: first(searchParams.review) === "1",
    page:
      Number.isSafeInteger(parsedPage) && parsedPage <= MAX_PAGE
        ? parsedPage
        : 1,
  };
  if (country && COUNTRY_SLUG.test(country)) query.country = country;
  if (validDimension(dimension)) query.dimension = dimension;
  if (validSeverity(severity)) query.severity = severity;
  return query;
}

export function pulseChangelogPageOffset(query: PulseChangelogPageQuery): number {
  return (query.page - 1) * PULSE_CHANGELOG_PAGE_SIZE;
}

export function pulseChangelogSearch(
  query: PulseChangelogPageQuery,
): string {
  const params = new URLSearchParams();
  if (query.country) params.set("country", query.country);
  if (query.dimension) params.set("dimension", query.dimension);
  if (query.severity) params.set("severity", query.severity);
  if (query.showReview) params.set("review", "1");
  if (query.page > 1) params.set("page", String(query.page));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * Protect the client/RSC boundary against a future query regression. A page
 * that returns more than the declared limit must fail on the server rather than
 * silently serializing a whole research feed into the initial document.
 */
export function requireBoundedPulseChangelogPage<Row>(
  rows: readonly Row[],
): readonly Row[] {
  if (rows.length > PULSE_CHANGELOG_PAGE_SIZE) {
    throw new Error(
      "Pulse changelog result boundary violated; refuse to serialize an oversized response.",
    );
  }
  return rows;
}
