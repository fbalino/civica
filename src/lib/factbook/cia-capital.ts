export const CIA_FACTBOOK_SOURCE_URL =
  "https://github.com/factbook/factbook.json";
export const CIA_FACTBOOK_UPSTREAM_VINTAGE =
  "CIA Factbook 2026-01-frozen";

export interface CiaCapitalFact {
  factKey: "capital";
  factGroup: "A";
  category: "government";
  sourceUrl: string;
  factValue: string;
  factValueNumeric: null;
  factUnit: null;
  factYear: null;
  valueStatus: "observed";
  valueStatusReason: null;
  dataVintageYear: null;
  upstreamVintageLabel: string;
  methodologyVersion: "v0.2-beta";
  valueType: "measured";
  growthMethodology: null;
}

export interface ComparableCiaCapitalFact {
  factGroup?: unknown;
  category?: unknown;
  sourceUrl?: unknown;
  factValue?: unknown;
  factValueNumeric?: unknown;
  factUnit?: unknown;
  factYear?: unknown;
  valueStatus?: unknown;
  valueStatusReason?: unknown;
  asOf?: unknown;
  dataVintageYear?: unknown;
  retrievedAt?: unknown;
  upstreamVintageLabel?: unknown;
  methodologyVersion?: unknown;
  sourceNote?: unknown;
  valueType?: unknown;
  growthMethodology?: unknown;
}

const CAPITAL_SEMANTIC_FIELDS = [
  "factGroup",
  "category",
  "sourceUrl",
  "factValue",
  "factValueNumeric",
  "factUnit",
  "factYear",
  "valueStatus",
  "valueStatusReason",
  "asOf",
  "dataVintageYear",
  "upstreamVintageLabel",
  "methodologyVersion",
  "sourceNote",
  "valueType",
  "growthMethodology",
] as const satisfies readonly (keyof ComparableCiaCapitalFact)[];

function instant(value: unknown): number {
  return value instanceof Date
    ? value.getTime()
    : new Date(String(value)).getTime();
}

/** PostgreSQL stores the retained import time as `timestamp` without a zone.
 * The query converts that UTC-convention value to epoch milliseconds before
 * it crosses a driver, so the host timezone can never shift the provenance. */
export function retainedFactbookDateFromEpoch(value: unknown): Date {
  const milliseconds = Number(value);
  const date = new Date(milliseconds);
  if (!Number.isFinite(milliseconds) || !Number.isFinite(date.getTime())) {
    throw new Error("Retained Factbook provenance has an invalid UTC epoch");
  }
  return date;
}

/** The Neon/Postgres encoder may serialize `Date` as host-local wall-clock
 * text before inserting into a timezone-free column. This repair carries a
 * retained UTC instant, so bind dates as explicit ISO strings instead. */
export function canonicalCapitalSqlParameters(
  parameters: readonly unknown[],
): unknown[] {
  return parameters.map((parameter) =>
    parameter instanceof Date ? parameter.toISOString() : parameter,
  );
}

export function canonicalCapitalFactMatches(
  existing: ComparableCiaCapitalFact,
  proposed: ComparableCiaCapitalFact,
): boolean {
  return (
    CAPITAL_SEMANTIC_FIELDS.every(
      (field) => existing[field] === proposed[field],
    ) && instant(existing.retrievedAt) === instant(proposed.retrievedAt)
  );
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&([a-z]+);/gi, (_, entity: string) => {
    const map: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      ocirc: "ô",
      eacute: "é",
      egrave: "è",
      agrave: "à",
      uuml: "ü",
      ouml: "ö",
      auml: "ä",
      ntilde: "ñ",
      ccedil: "ç",
      iacute: "í",
      aacute: "á",
      oacute: "ó",
      uacute: "ú",
      nbsp: " ",
    };
    return map[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function normalizedObjectKey(
  value: Record<string, unknown>,
  expected: string,
): string | undefined {
  const normalized = expected.trim().toLowerCase().replace(/\s+/g, "_");
  return Object.keys(value).find(
    (key) => key.trim().toLowerCase().replace(/\s+/g, "_") === normalized,
  );
}

function nestedValue(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    const object = current as Record<string, unknown>;
    const actualKey = normalizedObjectKey(object, key);
    current = actualKey ? object[actualKey] : undefined;
  }
  return current;
}

function extractedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = decodeHtmlEntities(value).trim();
  return clean && clean !== "[object Object]" ? clean : null;
}

/** Extract the retained `Government.Capital.name.text` value without
 * inventing an absence row when the publisher payload has no capital. */
export function extractCiaCapital(governmentSection: unknown): string | null {
  return extractedText(
    nestedValue(governmentSection, "Capital", "name", "text"),
  );
}

export function buildCiaCapitalFact(
  governmentSection: unknown,
): CiaCapitalFact | null {
  const factValue = extractCiaCapital(governmentSection);
  if (!factValue) return null;
  return {
    factKey: "capital",
    factGroup: "A",
    category: "government",
    sourceUrl: CIA_FACTBOOK_SOURCE_URL,
    factValue,
    factValueNumeric: null,
    factUnit: null,
    factYear: null,
    valueStatus: "observed",
    valueStatusReason: null,
    dataVintageYear: null,
    upstreamVintageLabel: CIA_FACTBOOK_UPSTREAM_VINTAGE,
    methodologyVersion: "v0.2-beta",
    valueType: "measured",
    growthMethodology: null,
  };
}
