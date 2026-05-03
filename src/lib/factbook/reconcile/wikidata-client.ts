/**
 * Phase F.2 — Wikidata SPARQL client.
 *
 * Thin rate-limited HTTP wrapper around https://query.wikidata.org/sparql.
 * Wikidata's etiquette guidelines ask for ≤ 5 requests/second per
 * client and a meaningful User-Agent that identifies the operator
 * and provides a contact path. We honour both, plus retry-once on
 * 429 / 5xx with exponential backoff.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 (sources)
 * Implementation plan: F.2.
 *
 * Lazy-init: do NOT do any work at import time. Per the project's
 * static-import + dotenv hoist convention (see the multi-line note
 * in `scripts/sync-factbook-cia.ts` history and the bills syncs),
 * any module-level state that depends on env vars is initialised
 * inside an exported function.
 */

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

const USER_AGENT =
  "Civica/0.1 (https://civicaatlas.org; fbalino@gmail.com) " +
  "fact-reconciliation Phase F.2";

/** Wikidata politeness floor: 5 req/s. We clamp to 4 to leave headroom. */
const MIN_INTERVAL_MS = 250;

/** Last-request timestamp; module-level state, fine for a single-
 *  process sync run. */
let lastRequestAt = 0;

/** SPARQL JSON result shape (subset we use). */
export interface SparqlBinding {
  [key: string]: {
    type: "uri" | "literal" | "bnode" | "typed-literal";
    value: string;
    datatype?: string;
    "xml:lang"?: string;
  };
}

export interface SparqlResult {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const delta = now - lastRequestAt;
  if (delta < MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_INTERVAL_MS - delta)
    );
  }
  lastRequestAt = Date.now();
}

/**
 * Run a SPARQL SELECT query against Wikidata. Returns JSON result
 * with bindings.
 *
 * On HTTP 429 / 503 / 504, retries once after a short backoff.
 * On any other error, throws.
 */
export async function runSparql(query: string): Promise<SparqlResult> {
  await throttle();

  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("query", query);

  const headers: Record<string, string> = {
    Accept: "application/sparql-results+json",
    "User-Agent": USER_AGENT,
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers });

      if (res.status === 429 || res.status === 503 || res.status === 504) {
        // back off a bit, retry once
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `SPARQL ${res.status} ${res.statusText}: ${body.slice(0, 200)}`
        );
      }

      const json = (await res.json()) as SparqlResult;
      return json;
    } catch (err) {
      lastErr = err;
      // network error — retry once
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
    }
  }

  throw new Error(
    `SPARQL query failed after retries: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}

/**
 * Pull all values + references for a (entity, property) pair on
 * Wikidata. Returns one row per (statement, reference); the
 * caller groups by statement IRI in JS.
 *
 * Filters out deprecated rank at the SPARQL level. Preferred and
 * normal ranks both pass through; the caller's rank-aware logic
 * decides which statement wins.
 *
 * Returns an array of decoded `WikidataClaimRow` (see below).
 */
export interface WikidataClaimRow {
  /** Statement IRI — stable identifier for grouping multiple
   *  reference rows belonging to the same claim. */
  statementIri: string;
  /** The numeric or string value, raw from Wikidata. Unit is
   *  separately surfaced via `valueUnitQid`. */
  valueRaw: string;
  /** Wikidata Q-ID of the unit, e.g. "Q4917" for USD. May be
   *  undefined on dimensionless values. */
  valueUnitQid: string | undefined;
  /** ISO date for the qualifier `point in time` (P585). May be
   *  undefined; in that case we fall back to the statement's
   *  `start time` (P580) when present. */
  pointInTime: string | undefined;
  /** Wikidata rank — 'preferred' | 'normal'. Deprecated already
   *  filtered out at the SPARQL level. */
  rank: "preferred" | "normal";
  /** Q-ID of the upstream source entity. Sourced from
   *  `stated in` (P248) when present, otherwise from
   *  `publisher` (P123). R.0 / 2026-05-03: P123 fallback added
   *  because Wikidata editors are inconsistent about which
   *  property they use for source attribution; some demographic
   *  properties (P8763 birth_rate, P10091 death_rate) almost
   *  exclusively use P123. The allowlist treats both identically. */
  refStatedInQid: string | undefined;
  /** English label for the source entity, where available. */
  refStatedInLabel: string | undefined;
  /** Reference URL (P854), if any. */
  refUrl: string | undefined;
}

export async function getClaimsForEntity(
  entityQid: string,
  propertyPid: string
): Promise<WikidataClaimRow[]> {
  // SPARQL builds the full claim graph in one shot. We pull:
  //   - statement IRI (?stmt)
  //   - value (?value)
  //   - value unit (?unit) for quantity-typed values
  //   - point in time (?pit) — common qualifier for time-series
  //   - start time (?startTime) — fallback when pit is absent
  //   - rank (?rank)
  //   - per-reference rows: ?refStatedIn, ?refStatedInLabel, ?refUrl
  //
  // The same statement may appear N times (one per reference).
  // The caller groups by ?stmt.
  //
  // R.0 / 2026-05-03 (per `~/civica/plan/wikidata-sort-resolution-v1.md`
  // §3 item 2): the original query asked for `pr:P248` (stated in)
  // and `pr:P854` (URL) only. Empirical SPARQL probe on
  // 2026-05-03 against Q3624078 sovereign states found:
  //   P8763 (birth_rate)         — 0 statements with pr:P248,
  //                                 751 with pr:P123 (publisher).
  //   P10091 (death_rate)        — 0 with pr:P248, 750 with P123.
  //   P1082 (population_total)   — 8,658 with P248 (working
  //                                 baseline; this is why population
  //                                 sync produced 26 rows while
  //                                 birth/death produced 0).
  //
  // Wikidata editors are inconsistent about whether to attach a
  // source citation via `stated in` (P248) or `publisher` (P123);
  // both are structurally Q-IDs pointing at the same kind of
  // organisation. The fix is to extract both and let the
  // allowlist gate (`isAllowedReference`) sort tier-1 from
  // junk in the consumer. P248 still takes precedence when
  // present; P123 is the fallback.
  const query = `
    SELECT
      ?stmt ?value ?unit ?pit ?startTime ?rank
      ?refStatedIn ?refStatedInLabel ?refPublisher ?refPublisherLabel ?refUrl
    WHERE {
      wd:${entityQid} p:${propertyPid} ?stmt.
      ?stmt ps:${propertyPid} ?value.
      ?stmt wikibase:rank ?rank.
      FILTER(?rank != wikibase:DeprecatedRank)

      OPTIONAL {
        ?stmt psv:${propertyPid} ?vNode.
        ?vNode wikibase:quantityUnit ?unit.
      }
      OPTIONAL { ?stmt pq:P585 ?pit. }
      OPTIONAL { ?stmt pq:P580 ?startTime. }

      OPTIONAL {
        ?stmt prov:wasDerivedFrom ?ref.
        OPTIONAL {
          ?ref pr:P248 ?refStatedIn.
          OPTIONAL {
            ?refStatedIn rdfs:label ?refStatedInLabel.
            FILTER(LANG(?refStatedInLabel) = 'en')
          }
        }
        OPTIONAL {
          ?ref pr:P123 ?refPublisher.
          OPTIONAL {
            ?refPublisher rdfs:label ?refPublisherLabel.
            FILTER(LANG(?refPublisherLabel) = 'en')
          }
        }
        OPTIONAL { ?ref pr:P854 ?refUrl. }
      }
    }
    ORDER BY DESC(?pit) DESC(?startTime)
  `;

  const json = await runSparql(query);

  return json.results.bindings.map((b): WikidataClaimRow => {
    const statementIri = b.stmt?.value ?? "";
    const valueRaw = b.value?.value ?? "";
    const unitFull = b.unit?.value;
    const valueUnitQid = unitFull
      ? unitFull.split("/").pop() // e.g. "Q4917"
      : undefined;
    const pit = b.pit?.value;
    const start = b.startTime?.value;
    const pointInTime = pit ?? start;
    const rankRaw = b.rank?.value ?? "";
    const rank: "preferred" | "normal" = rankRaw.endsWith("PreferredRank")
      ? "preferred"
      : "normal";
    // R.0 / 2026-05-03: prefer P248 (stated in) when present,
    // fall back to P123 (publisher). Both are Q-IDs naming the
    // upstream source entity; the allowlist treats them
    // identically. See the SPARQL comment block above.
    const refStatedInFull = b.refStatedIn?.value ?? b.refPublisher?.value;
    const refStatedInQid = refStatedInFull
      ? refStatedInFull.split("/").pop()
      : undefined;
    const refStatedInLabel =
      b.refStatedInLabel?.value ?? b.refPublisherLabel?.value;
    const refUrl = b.refUrl?.value;

    return {
      statementIri,
      valueRaw,
      valueUnitQid,
      pointInTime,
      rank,
      refStatedInQid,
      refStatedInLabel,
      refUrl,
    };
  });
}

/**
 * Group reference rows by statement IRI. Each statement may have
 * 0..N references. Returns a map from statement IRI to the
 * statement metadata + its references.
 */
export interface GroupedClaim {
  statementIri: string;
  valueRaw: string;
  valueUnitQid: string | undefined;
  pointInTime: string | undefined;
  rank: "preferred" | "normal";
  references: Array<{
    statedInQid: string | undefined;
    statedInLabel: string | undefined;
    url: string | undefined;
  }>;
}

export function groupClaimsByStatement(
  rows: WikidataClaimRow[]
): GroupedClaim[] {
  const map = new Map<string, GroupedClaim>();

  for (const row of rows) {
    const key = row.statementIri;
    if (!key) continue;

    let existing = map.get(key);
    if (!existing) {
      existing = {
        statementIri: row.statementIri,
        valueRaw: row.valueRaw,
        valueUnitQid: row.valueUnitQid,
        pointInTime: row.pointInTime,
        rank: row.rank,
        references: [],
      };
      map.set(key, existing);
    }

    if (row.refStatedInQid || row.refUrl) {
      existing.references.push({
        statedInQid: row.refStatedInQid,
        statedInLabel: row.refStatedInLabel,
        url: row.refUrl,
      });
    }
  }

  return Array.from(map.values());
}
