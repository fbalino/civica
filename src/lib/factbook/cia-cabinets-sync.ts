/**
 * CIA "World Leaders" cabinet sync — orchestration (library form).
 *
 * Ingests the full per-country official list from the CIA World Leaders
 * directory (`cia.gov/resources/world-leaders/foreign-governments/<slug>/`)
 * into Civica's government-structure spine (`government_bodies` → `offices`
 * → `persons` → `terms` + `statements` provenance).
 *
 * Owner decisions (P4 v1, 2026-07-01):
 *   1. Persons: exact-name match to an existing person → else create ID-less
 *      (`wikidata_qid = null`). Never fuzzy-merge. QID attachment is DECOUPLED
 *      from the crawl: it runs as a separate, deferred, throttled backfill
 *      (`backfillCabinetQids()` / `scripts/sync-cia-cabinets.ts --backfill-qids`)
 *      so the apply crawl carries no per-person Wikidata network call. The crawl
 *      path is therefore just the 10s CIA crawl-delay + local DB writes.
 *   2. v1 scope = EVERYTHING the CIA lists per country (cabinet ministers +
 *      central-bank governor + ambassadors / diplomatic posts + any other
 *      listed official). Each position is TAGGED by category (`office_type`)
 *      rather than filtered out. The head-of-state / head-of-government rows
 *      are skipped (they are owned by the QID-backed Wikidata spine).
 *
 * Judiciary is NOT in the CIA lists → out of scope (separate P4b).
 *
 * DAT-037 roster contract (see `cabinet-roster.ts`): CIA publishes titles and
 * current holders plus one page-level "Last Updated" date, never appointment
 * dates. A cabinet term is identified by `(office, person)` and never stores a
 * start date. Each run reconciles every listed title's current holders to
 * exactly the people the page lists (multi-seat titles keep every holder),
 * releases the list position of titles the page no longer lists and retires
 * their holders, writes nothing for an unchanged roster, and records the page
 * date as one sourced body-level statement. Each country's writes commit in
 * one Neon transaction.
 *
 * `computeCabinetPlan()` fetches and parses pages (reads jurisdictions only);
 * the apply path re-reads each country's stored roster, resolves people with
 * a deterministic tiered match, plans the reconciliation with the pure
 * `planCountryRoster()`, and stamps `sources.last_sync_at` via
 * `markSourcesSynced("cia_world_leaders", …)` only when rows actually changed.
 *
 * The apply path persists cabinet + central-bank + deputy + other categories
 * and DROPS the `diplomatic` category (Ambassador-to-US / UN-rep). The
 * `united-states` page is skipped (404 — foreign governments only) and
 * sub-national HK/Macau blocks are cut at the section boundary by
 * `parseCountryHtml`.
 */
import dns from "node:dns";
import { randomUUID } from "node:crypto";

import { and, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { db as sharedDb } from "@/lib/db";
import {
  jurisdictions,
  persons,
  terms,
  statements,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import {
  CABINET_MEMBER_PREDICATE,
  CABINET_ROSTER_PREDICATE,
  CIA_ROSTER_LICENSE,
  CIA_ROSTER_OFFICE_TYPES,
  CIA_SLUG_OVERRIDES,
  isVacantHolderText,
  parseRosterStamp,
  planCountryRoster,
  rosterContentHash,
  type CountryRosterPlan,
  type CountryRosterState,
  type RosterHolder,
  type RosterTitle,
} from "@/lib/factbook/cabinet-roster";
import { resolveAtlasReleaseId } from "@/lib/factbook/country-fact-history-writer";
import {
  buildGovernmentBodyHistoryStatement,
  buildOfficeHistoryStatement,
  buildPersonHistoryStatement,
  governmentEntityHistoryWriters,
  type GovernmentEntityHistoryContext,
  type GovernmentEntityHistoryWriters,
} from "@/lib/factbook/government-entity-history-writer";

// ─── Config ──────────────────────────────────────────────────────────────────

const CIA_BASE =
  "https://www.cia.gov/resources/world-leaders/foreign-governments";

/**
 * cia.gov returns HTTP 403 to naive user-agents. A descriptive, browser-plausible
 * UA is required — mirror the Commons UA the officeholders sync already uses.
 */
const CIA_USER_AGENT =
  "CivicaAtlas/1.0 (https://civicaatlas.org; admin@civicaatlas.org)";

/**
 * robots.txt sets `Crawl-delay: 10` for `User-agent: *`. Honor it. The delay is
 * applied BETWEEN country fetches (not before the first).
 */
const CIA_CRAWL_DELAY_MS = 10_000;

// ─── Network resilience (IPv4-first + long connect timeout) ──────────────────
//
// cia.gov advertises AAAA records whose IPv6 addresses (e.g. 2600:1403:…) are
// frequently unreachable from this network. Node's default happy-eyeballs order
// tries IPv6 FIRST and stalls the full connect timeout (~10s → UND_ERR_CONNECT_
// TIMEOUT) before falling back to IPv4 — the failure mode that killed the crawl
// at `angola`. This mirrors the GDELT `family:4` fix noted in project memory.
//
// Two independent guards, so the fix holds with or without the `undici` package:
//   1. `dns.setDefaultResultOrder("ipv4first")` — a built-in Node API (no
//      dependency) that makes DNS hand back IPv4 addresses first, so the connect
//      attempts IPv4 up front instead of stalling on unreachable IPv6.
//   2. When `undici` is importable, an `Agent` with `connect:{ family:4,
//      timeout:30_000 }` is passed as the `fetch` `dispatcher` — pinning IPv4
//      AND lengthening the connect timeout to 30s. Degrades gracefully (guard 1
//      alone is sufficient) when undici isn't installed.

// Prefer IPv4 addresses in DNS resolution results process-wide for these fetches.
// Dependency-free and always available; the primary defense against the stall.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Older runtimes without the API: fall through — the undici dispatcher and the
  // per-country retry below still make the crawl resilient.
}

/** Connect timeout for the CIA fetches (ms) — long enough to ride out a slow TLS
 * handshake without the 10s IPv6 stall (which no longer happens with IPv4-first). */
const CIA_CONNECT_TIMEOUT_MS = 30_000;

/**
 * Lazily-built undici dispatcher pinning IPv4 with a 30s connect timeout. Passed
 * as `fetch`'s `dispatcher` when available. `undici` is not a hard dependency of
 * this repo, so the import is dynamic + best-effort: if it isn't installed we
 * return `undefined` and rely on `ipv4first` + retries. Memoized (built once).
 */
let ciaDispatcherPromise: Promise<unknown | undefined> | undefined;
function getCiaDispatcher(): Promise<unknown | undefined> {
  if (!ciaDispatcherPromise) {
    ciaDispatcherPromise = (async () => {
      try {
        // Indirect specifier so TypeScript/bundlers don't try to statically
        // resolve `undici` (it's an optional runtime dependency, not installed
        // here). At runtime Node resolves it if present; otherwise this throws
        // and we degrade to the `ipv4first` guard below.
        const spec = "undici";
        const undici = (await import(/* webpackIgnore: true */ spec)) as {
          Agent?: new (opts: unknown) => unknown;
        };
        if (!undici.Agent) return undefined;
        return new undici.Agent({
          connect: { family: 4, timeout: CIA_CONNECT_TIMEOUT_MS },
        });
      } catch {
        // undici not installed — `ipv4first` already handles IPv6-first stalls.
        return undefined;
      }
    })();
  }
  return ciaDispatcherPromise;
}

/** Classify whether a thrown fetch error is a transient network/timeout failure
 * worth retrying (connect timeouts, resets, DNS blips, aborts). */
function isRetryableNetworkError(err: unknown): boolean {
  const e = err as { name?: string; code?: string; cause?: { code?: string } };
  const code = e?.code ?? e?.cause?.code ?? "";
  return (
    e?.name === "AbortError" ||
    e?.name === "TimeoutError" ||
    /^(UND_ERR_|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNABORTED)/.test(
      code,
    )
  );
}

/**
 * Classify whether a thrown DB error is a transient Neon-HTTP network/timeout
 * failure worth retrying. Neon's serverless driver talks over HTTP(S), so a
 * flaky connection surfaces as the same undici/socket codes as a fetch
 * (`UND_ERR_*`, `ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN`, ConnectTimeout) — plus
 * a bare `fetch failed` message and Neon 5xx gateway responses. A persistent
 * logical error (bad SQL, constraint violation) is NOT retryable and re-throws
 * immediately.
 */
function isRetryableDbError(err: unknown): boolean {
  if (isRetryableNetworkError(err)) return true;
  const e = err as {
    name?: string;
    message?: string;
    code?: string | number;
    status?: number;
    statusCode?: number;
  };
  const msg = (e?.message ?? "").toLowerCase();
  if (
    /fetch failed|connecttimeout|connect timeout|socket hang up|network|timed? ?out|econnreset|etimedout|eai_again|und_err_/.test(
      msg,
    )
  ) {
    return true;
  }
  // Neon HTTP 5xx (gateway/timeout) — retry; 4xx (logical) — do not.
  const status = e?.status ?? e?.statusCode;
  if (typeof status === "number" && status >= 500 && status <= 599) return true;
  return false;
}

/**
 * Retry a transient DB call (Neon-HTTP timeout/reset) with exponential backoff.
 * Minimal + local to this file — the crawl's per-country Neon reads/writes are
 * wrapped in this so a single serverless-HTTP blip retries instead of killing
 * the whole ~194-country run. Non-transient errors (bad SQL, constraint) fail
 * fast on the first throw. Backoff waits (default): ~1s, 3s, 8s, 20s.
 */
async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; log?: (line: string) => void; label?: string } = {},
): Promise<T> {
  const tries = opts.tries ?? 4;
  const backoffs = [1_000, 3_000, 8_000, 20_000];
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableDbError(err) || attempt === tries) break;
      const wait = backoffs[Math.min(attempt - 1, backoffs.length - 1)];
      const reason = (err as Error)?.message ?? String(err);
      opts.log?.(
        `  ↻ db${opts.label ? ` ${opts.label}` : ""}: transient error (${reason}); retry ${attempt}/${tries - 1} in ${Math.round(wait / 1000)}s`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * The source row for provenance + freshness. RECOMMENDATION (owner flag b):
 * seed a dedicated `cia_world_leaders` source rather than reuse `cia_factbook`
 * — the World Leaders directory is a distinct publication at a distinct URL
 * (`/resources/world-leaders/`) with its own monthly cadence and its own
 * per-country "Last Updated" stamps. Same license posture as the Factbook
 * (US-federal public domain, commercial-use OK, attribution to CIA requested).
 * The apply round seeds this row before writing (and stamps it via
 * `markSourcesSynced`).
 */
export const CIA_WORLD_LEADERS_SOURCE_ID = "cia_world_leaders";

export type CabinetSyncDb = typeof sharedDb;

export interface CabinetCountryFetchResult {
  ok: boolean;
  status: number;
  html: string;
}

export interface CabinetSyncOptions {
  db?: CabinetSyncDb;
  onProgress?: (line: string) => void;
  /**
   * Restrict the fetch to these jurisdiction slugs (CIA slug form). When
   * omitted, the full ~195-country index would be crawled. The dry-run CLI
   * passes a ~12-country sample.
   */
  slugs?: string[];
  /** Crawl-delay override (ms) between country fetches. Defaults to 10s. */
  crawlDelayMs?: number;
  dryRun?: boolean;
  plan?: CabinetPlan;
  markSynced?: typeof markSourcesSynced;
  atlasReleaseId?: string;
  /** Database-free fixture seam for HTTP/status/schema regression tests. */
  fetchCountryPage?: (slug: string) => Promise<CabinetCountryFetchResult>;
  /** Fixture seam that avoids real retry backoff waits. */
  retryWait?: (delayMs: number) => Promise<void>;
  /** Fixture seam for deterministic office/term/person UUIDs. */
  newId?: () => string;
}

// ─── Position category classification ────────────────────────────────────────
//
// Every parsed `#### <title>` → `<name>` pair is classified into ONE bucket.
// The head rows are SKIPPED (owned by the QID-backed Wikidata spine); every
// other listed official is INGESTED, tagged with an `office_type`.

export type PositionCategory =
  | "head" // head of state / head of government — SKIP (spine owns it)
  | "deputy" // vice president / deputy PM → office_type 'deputy_head'
  | "cabinet" // ministers / secretaries → office_type 'cabinet'
  | "central_bank" // central-bank governor → office_type 'central_bank'
  | "diplomatic" // ambassadors / permanent reps → office_type 'diplomatic'
  | "other"; // anything listed we can't bucket → office_type 'official'

/** Map a category to the stored `offices.office_type`. */
export function officeTypeForCategory(cat: PositionCategory): string {
  switch (cat) {
    case "head":
      return "head"; // not written — spine owns heads
    case "deputy":
      return "deputy_head";
    case "cabinet":
      return "cabinet";
    case "central_bank":
      return "central_bank";
    case "diplomatic":
      return "diplomatic";
    case "other":
    default:
      return "official";
  }
}

// Head-of-state / head-of-government titles the CIA lists at the top. These are
// SKIPPED — the Wikidata spine already owns them with a QID, party, portrait,
// DOB. Matching is anchored to the START of the title (with an optional "Fed."
// / "Federal" prefix and no trailing comma-qualifier) so a bare head title is
// caught but "Pres., Bundesbank" / "Pres., Central Bank" (a central-bank
// president) is NOT — the comma-qualifier drops it through to CENTRAL_BANK_RE.
// "State Council" premier likewise carries a comma-qualifier and is a head of
// government; it is matched explicitly.
const HEAD_TITLE_RE =
  /^(fed\.?\s+|federal\s+)?(pres\.?|president|king|queen|monarch|emir|amir|sultan|emperor|empress|pope|supreme leader|prime min\.?|prime minister|premier|chancellor|chief of state|head of (state|government)|co[- ]?prince|grand duke|grand duchess|sovereign prince|yang di-?pertuan|captain[- ]regent|paramount)(\s+of\b|,\s*state council\b|\s*$|\s*&|\s+and\b)/i;

const DEPUTY_TITLE_RE =
  /\b(vice pres\.?|vice president|deputy prime min\.?|deputy prime minister|vice premier|deputy premier|vice chancellor|first vice|second vice|deputy chair(man|person)? of|vice[- ]?chair(man|person)?)\b/i;

// A central bank president/governor. Anchored to a bank/reserve/monetary token
// so it fires for "Pres., Bundesbank", "Governor, Bank of X", "Pres., Central
// Bank" — but not a country president.
const CENTRAL_BANK_RE =
  /\b(governor|pres\.?|president|chair(man|person)?|chief executive)\b[^]*\b(bundesbank|central bank|reserve bank|national bank|monetary authority|people's bank|bank of [a-z])/i;

const DIPLOMATIC_RE =
  /\b(ambassador|permanent representative|perm\.? rep\.?|charg[eé] d.affaires|high commissioner|consul|envoy|apostolic nuncio|nuncio)\b/i;

const CABINET_RE =
  /(\bmin\.?\b|\bminister\b|\bsec\.?\s+(of|for|gen\.?)\b|\bsecretary\b|\battorney gen(eral|\.)?\b|\bstate councilor\b|\bstate councillor\b|\bsolicitor gen(eral|\.)?\b|\bcomptroller\b|\bauditor gen(eral|\.)?\b|\bprosecutor gen(eral|\.)?\b|\bchief cabinet\b|\bcabinet sec\b|\bchmn\.?\b|\bchairman\b|\bchairperson\b|\bchief of the\b|\bhead,\s|\bkeeper of the seals\b|\bnational security adviser\b)/i;

/**
 * Cabinet posts whose titles begin with a head-of-state token. "Chancellor of
 * the Exchequer" (UK finance minister) and "Chancellor of the Duchy of
 * Lancaster" are ministers, not heads of government.
 */
const CABINET_CHANCELLOR_RE = /^chancellor of the (exchequer|duchy)\b/i;

// Bosnia and Herzegovina's national block lists its three-member presidency
// and Council chair with titles that would otherwise look like generic
// officials. Keep these exceptions scoped to the one publisher page whose
// structure requires them; matching Council chairs globally would skip valid
// cabinet and committee roles elsewhere.
const BOSNIA_SLUG = "bosnia-and-herzegovina";
const BOSNIA_HEAD_TITLE_RE =
  /^(?:Presidency Member \((?:Bosniak|Croat|Serb)\)|Chmn\., Council of Ministers)$/i;
const BOSNIA_DEPUTY_TITLE_RE =
  /^Dep\. Chmn\., Council of Ministers, and Min\. of (?:Defense|Foreign Trade & Economic Relations)$/i;

/**
 * Classify a CIA position title into a category. Order matters: head first
 * (skip), then the specific non-cabinet buckets (central bank, diplomatic),
 * then deputy, then the broad cabinet catch, then "other".
 */
export function classifyPosition(
  title: string,
  slug?: string,
): PositionCategory {
  const t = title.trim();
  // Central bank FIRST — a "Pres., Bundesbank" / "Governor, Bank of X" must not
  // be mistaken for a country president or a minister.
  if (CENTRAL_BANK_RE.test(t)) return "central_bank";
  if (slug === BOSNIA_SLUG && BOSNIA_HEAD_TITLE_RE.test(t)) return "head";
  if (CABINET_CHANCELLOR_RE.test(t)) return "cabinet";
  if (HEAD_TITLE_RE.test(t)) return "head";
  if (DIPLOMATIC_RE.test(t)) return "diplomatic";
  if (slug === BOSNIA_SLUG && BOSNIA_DEPUTY_TITLE_RE.test(t)) return "deputy";
  if (DEPUTY_TITLE_RE.test(t)) return "deputy";
  if (CABINET_RE.test(t)) return "cabinet";
  return "other";
}

// ─── Fetch + parse ───────────────────────────────────────────────────────────

export interface ParsedPosition {
  /** CIA position title, verbatim (HTML-entity-decoded). */
  title: string;
  /** Holder name as printed by the CIA (`Firstname SURNAME`), verbatim. */
  rawName: string | null;
  /** Position index in the CIA list (0-based) — drives `offices.display_order`. */
  order: number;
  category: PositionCategory;
}

export interface ParsedCountry {
  slug: string;
  /** CIA page H1 country name (best-effort). */
  countryName: string | null;
  /** Per-country "Last Updated: M/D/YYYY" stamp, verbatim. */
  lastUpdated: string | null;
  positions: ParsedPosition[];
  /** True when the page fetched but the leaders section was absent/malformed. */
  parseFailed: boolean;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "’")
    .replace(/&#x2019;/g, "’")
    .replace(/&eacute;/g, "é")
    .replace(/&aacute;/g, "á")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/**
 * Parse the CIA World Leaders per-country HTML.
 *
 * Structure (verified live 2026-07-01):
 *   <h2>Leaders and Cabinet Members</h2>
 *   <div class="last-updated"><b>Last Updated</b>: <span>M/D/YYYY</span></div>
 *   <div class="leader-info"><h4>POSITION</h4><p>NAME</p></div>   (× N, in order)
 *   … then a "Explore Foreign Governments" section (end sentinel).
 *
 * v1 IGNORES sub-national blocks (e.g. China → Hong Kong / Macau): Civica models
 * sovereign jurisdictions here, so attaching HK offices to "China" would be
 * wrong. Most pages put the sovereign list before any leaders-section heading,
 * so the first heading remains the end boundary. Bosnia is the narrow
 * exception: its sovereign list begins under the explicit National Govt.
 * heading and ends at the next section. An unrecognized leading heading fails
 * closed instead of treating an arbitrary first region as national.
 */
export function parseCountryHtml(slug: string, html: string): ParsedCountry {
  const start = html.indexOf("Leaders and Cabinet Members");
  const end = html.indexOf("Explore Foreign Governments");
  const result: ParsedCountry = {
    slug,
    countryName: null,
    lastUpdated: null,
    positions: [],
    parseFailed: false,
  };

  // Best-effort country name from the first <h1>.
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) result.countryName = stripTags(h1[1]) || null;

  if (start < 0 || end < 0 || end <= start) {
    result.parseFailed = true;
    return result;
  }
  let seg = html.slice(start, end);

  // The page date belongs to the whole country roster and precedes any optional
  // section heading. Read it before narrowing the position segment.
  const lu = seg.match(/Last Updated<\/b>\s*:?\s*<span>([^<]*)<\/span>/i);
  if (lu) result.lastUpdated = stripTags(lu[1]) || null;

  const sectionHeaders: Array<{ start: number; end: number; title: string }> = [];
  const sectionHeaderRe =
    /<h3\b[^>]*\bclass=(["'])[^"']*\bleaders-section\b[^"']*\1[^>]*>([\s\S]*?)<\/h3>/gi;
  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionHeaderRe.exec(seg)) !== null) {
    sectionHeaders.push({
      start: sectionMatch.index,
      end: sectionHeaderRe.lastIndex,
      title: stripTags(sectionMatch[2]),
    });
  }

  if (sectionHeaders.length > 0) {
    const firstPosition = seg.search(/<div class="leader-info"/i);
    const firstSection = sectionHeaders[0];

    if (firstPosition < 0 || firstSection.start < firstPosition) {
      const nationalSections = sectionHeaders.filter(
        ({ title }) => title === "National Govt.",
      );
      if (
        slug !== BOSNIA_SLUG ||
        firstSection.title !== "National Govt." ||
        nationalSections.length !== 1
      ) {
        result.parseFailed = true;
        return result;
      }

      seg = seg.slice(
        firstSection.end,
        sectionHeaders[1]?.start ?? seg.length,
      );
    } else {
      // China and similar pages put their sovereign roster before the first
      // regional heading. Preserve that established boundary.
      seg = seg.slice(0, firstSection.start);
    }
  }

  // Each position is a <div class="leader-info"><h4>title</h4><p>name</p></div>.
  const blockRe =
    /<div class="leader-info">\s*<h4[^>]*>([\s\S]*?)<\/h4>\s*(?:<p[^>]*>([\s\S]*?)<\/p>)?\s*<\/div>/gi;
  let m: RegExpExecArray | null;
  let order = 0;
  while ((m = blockRe.exec(seg)) !== null) {
    const title = stripTags(m[1]);
    const rawNameStr = m[2] != null ? stripTags(m[2]) : "";
    if (!title) continue;
    // CIA prints "Vacant" (and variants) for an unfilled post. It is a listed
    // title with no holder, never a person.
    const rawName =
      rawNameStr.length > 0 && !isVacantHolderText(rawNameStr)
        ? rawNameStr
        : null;
    result.positions.push({
      title,
      rawName,
      order: order++,
      category: classifyPosition(title, slug),
    });
  }

  if (result.positions.length === 0) result.parseFailed = true;
  return result;
}

/**
 * Fetch one CIA World Leaders country page. IPv4-pinned (via the undici
 * dispatcher when available, and always via `ipv4first` DNS order) with a 30s
 * connect/overall timeout. THROWS on a network/timeout error (so the retry loop
 * in `fetchCountryResilient` can back off and retry); returns `{ ok:false }`
 * for a non-2xx HTTP response (e.g. a 404, which is an expected skip — the
 * directory lists foreign governments only).
 */
async function fetchCountry(
  slug: string,
): Promise<CabinetCountryFetchResult> {
  const url = `${CIA_BASE}/${slug}/`;
  const dispatcher = await getCiaDispatcher();
  const res = await fetch(url, {
    headers: {
      "User-Agent": CIA_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    // 30s cap on the whole request; with IPv4-first there's no 10s IPv6 stall.
    signal: AbortSignal.timeout(CIA_CONNECT_TIMEOUT_MS),
    // `dispatcher` is an undici-specific fetch option (typed as `unknown` here
    // because undici is an optional/soft dependency). Omitted when unavailable.
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);
  const html = res.ok ? await res.text() : "";
  return { ok: res.ok, status: res.status, html };
}

/**
 * Resilient single-country fetch: retries a transient network/timeout failure
 * up to `maxAttempts` times with exponential backoff, so ONE flaky host never
 * aborts the ~194-country crawl. Expected 404s are returned immediately.
 * Retryable HTTP statuses (408/425/429/5xx) and genuine network/timeout errors
 * use the same bounded retry ladder. Exhausted/non-retryable non-2xx responses
 * are returned for the aggregate planner to record as explicit failures.
 *
 * The backoff waits are ADDITIONAL to the inter-country crawl-delay applied by
 * the loop — retries stay polite.
 */
async function fetchCountryResilient(
  slug: string,
  log: (line: string) => void,
  options: {
    maxAttempts?: number;
    fetcher?: (slug: string) => Promise<CabinetCountryFetchResult>;
    wait?: (delayMs: number) => Promise<void>;
  } = {},
): Promise<CabinetCountryFetchResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const fetcher = options.fetcher ?? fetchCountry;
  const waitForRetry =
    options.wait ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  // Exponential-ish backoff between retries (ms): 3s, 8s, 20s.
  const BACKOFFS_MS = [3_000, 8_000, 20_000];
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fetcher(slug);
      const retryableStatus =
        result.status === 408 ||
        result.status === 425 ||
        result.status === 429 ||
        (result.status >= 500 && result.status <= 599);
      if (result.ok || !retryableStatus || attempt === maxAttempts) {
        return result;
      }
      const delay = BACKOFFS_MS[Math.min(attempt - 1, BACKOFFS_MS.length - 1)];
      log(
        `  ↻ ${slug}: HTTP ${result.status}; retry ${attempt}/${maxAttempts - 1} in ${Math.round(delay / 1000)}s`,
      );
      await waitForRetry(delay);
    } catch (err) {
      lastErr = err;
      if (!isRetryableNetworkError(err) || attempt === maxAttempts) break;
      const delay = BACKOFFS_MS[Math.min(attempt - 1, BACKOFFS_MS.length - 1)];
      const reason = (err as Error)?.message ?? String(err);
      log(
        `  ↻ ${slug}: network error (${reason}); retry ${attempt}/${maxAttempts - 1} in ${Math.round(delay / 1000)}s`,
      );
      await waitForRetry(delay);
    }
  }
  throw lastErr;
}

// ─── Name normalization ──────────────────────────────────────────────────────
//
// CIA prints `Firstname SURNAME` with the family name uppercased (e.g.
// "Rachel REEVES"; for family-name-first cultures the local order is respected,
// "XI Jinping"). For matching + display we down-case the ALL-CAPS token(s) to
// title case. We keep the ORIGINAL token ORDER — we do not reorder names.

/** Title-case a single token, preserving internal apostrophes/hyphens/O'…. */
function titleCaseToken(tok: string): string {
  if (tok.length === 0) return tok;
  // Keep short lowercase particles as-is when they are already lowercase
  // (de, van, der, bin, al-) — but CIA usually uppercases only the surname.
  return tok
    .split(/([-'’])/)
    .map((part) =>
      /[-'’]/.test(part)
        ? part
        : part.length > 0
          ? part[0].toUpperCase() + part.slice(1).toLowerCase()
          : part,
    )
    .join("");
}

/**
 * Normalize a CIA-printed name to display/match form: any token that is ALL
 * UPPERCASE (the CIA surname convention) is title-cased; other tokens are left
 * as printed. Token order is preserved.
 */
export function normalizeCiaName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((tok) =>
      tok.length > 1 && tok === tok.toUpperCase() && /[A-Z]/.test(tok)
        ? titleCaseToken(tok)
        : tok,
    )
    .join(" ")
    .trim();
}

/** Lowercased, order-independent set of name tokens for loose comparison. */
function nameTokenSet(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[.,]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

// ─── Jurisdiction resolution (mirror officeholders-sync findJurisdiction) ────

async function findJurisdictionBySlug(
  db: CabinetSyncDb,
  slug: string,
): Promise<{ id: string; name: string; qid: string | null } | null> {
  const cols = {
    id: jurisdictions.id,
    name: jurisdictions.name,
    qid: jurisdictions.wikidataQid,
  };

  // 1. Direct slug match (the common case — most CIA slugs match ours).
  const bySlug = await db
    .select(cols)
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);
  if (bySlug.length > 0) return bySlug[0];

  // 2. Reverse override map: a divergent CIA slug (e.g. `korea-north`,
  //    `bahamas-the`) → the Civica jurisdiction slug (`north-korea`,
  //    `the-bahamas`).
  const jurisSlug = CIA_SLUG_TO_JURIS_SLUG[slug];
  if (jurisSlug) {
    const byOverride = await db
      .select(cols)
      .from(jurisdictions)
      .where(eq(jurisdictions.slug, jurisSlug))
      .limit(1);
    if (byOverride.length > 0) return byOverride[0];
  }

  // 3. Fall back to a name match (CIA slug is lowercase-hyphenated country name).
  const asName = slug.replace(/-/g, " ");
  const byName = await db
    .select(cols)
    .from(jurisdictions)
    .where(ilike(jurisdictions.name, asName))
    .limit(1);
  return byName.length > 0 ? byName[0] : null;
}

// ─── Person identity resolution (owner decision 1, DAT-037 tiers) ────────────

/** A roster name matched more than one stored person at the deciding tier. */
export class CabinetPersonIdentityError extends Error {
  constructor() {
    super("Cabinet person identity is ambiguous");
    this.name = "CabinetPersonIdentityError";
  }
}

/**
 * Wikidata entity search for a person by label + country context. Read-only;
 * returns a QID or null. Uses the `wbsearchentities` API (cheap, no SPARQL).
 * A hit is accepted only when the top result is a human (P31 Q5) whose label
 * token-set overlaps the query — conservative, to avoid false QIDs.
 *
 * NOT called from the crawl/apply path (that would add ~11s per person). Only
 * the deferred `backfillCabinetQids()` invokes this, off the critical path.
 */
async function searchWikidataPersonQid(
  name: string,
): Promise<string | null> {
  try {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("search", name);
    url.searchParams.set("language", "en");
    url.searchParams.set("type", "item");
    url.searchParams.set("limit", "5");
    url.searchParams.set("format", "json");
    const res = await fetch(url, {
      headers: { "User-Agent": CIA_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      search?: Array<{ id: string; label?: string; description?: string }>;
    };
    const wanted = nameTokenSet(name);
    for (const hit of data.search ?? []) {
      const label = hit.label ?? "";
      const desc = (hit.description ?? "").toLowerCase();
      const overlap = [...nameTokenSet(label)].filter((t) =>
        wanted.has(t),
      ).length;
      // Require the label to share ≥2 tokens with the query (or all tokens for
      // 1-token names) AND the description to look person-ish. This is a
      // dry-run PROPOSAL, surfaced for owner review — never an auto-merge.
      const enoughOverlap = wanted.size <= 1 ? overlap >= 1 : overlap >= 2;
      const personish =
        /politician|minister|diplomat|ambassador|governor|official|economist|lawyer|general|secretary|president|born \d{4}|\bmp\b/.test(
          desc,
        ) || desc === "";
      if (enoughOverlap && personish) return hit.id;
    }
  } catch {
    // Network hiccup → no QID; the person falls to the create-new path.
  }
  return null;
}

export interface RosterNameEntry {
  title: string;
  /** Normalized display name (`normalizeCiaName`). */
  name: string;
}

function rowsFromResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] } | null)?.rows ?? []) as T[];
}

async function executeRows<T>(
  database: CabinetSyncDb,
  statement: SQL,
): Promise<T[]> {
  return rowsFromResult<T>(await database.execute(statement));
}

/**
 * Resolve every listed name to one person — per owner decision 1 (exact name,
 * never fuzzy; otherwise a new QID-less person) with a deterministic order
 * among exact-name matches:
 *
 *   1. someone who already holds a term on this title's office;
 *   2. then someone who holds a term on another roster-typed office of this
 *      jurisdiction (roster continuity);
 *   3. then someone who holds any term in this jurisdiction;
 *   4. then someone with a Wikidata QID;
 *   5. then anyone else with that exact name.
 *
 * The first non-empty tier decides. More than one person in that tier is
 * ambiguous and fails the country closed rather than choosing arbitrarily.
 * Matching uses PostgreSQL `lower()` equality, so `_` and `%` in a name are
 * literal characters. READ-ONLY: never writes and never hits the network.
 */
export async function resolveRosterPersons(
  db: CabinetSyncDb,
  input: {
    jurisdictionId: string;
    entries: readonly RosterNameEntry[];
    officeIdByTitle: ReadonlyMap<string, string>;
    /** Run-scoped allocation of new QID-less person ids, keyed per country. */
    newPersonIds: Map<string, string>;
    newId: () => string;
  },
): Promise<Map<string, RosterHolder>> {
  const names = [...new Set(input.entries.map((entry) => entry.name))];
  const resolved = new Map<string, RosterHolder>();
  if (names.length === 0) return resolved;

  const candidates = await executeRows<{
    input: string;
    id: string;
    qid: string | null;
  }>(
    db,
    sql`SELECT r.input AS input, p.id::text AS id, p.wikidata_qid AS qid
        FROM jsonb_array_elements_text(${JSON.stringify(names)}::jsonb) AS r(input)
        JOIN persons p ON lower(p.name) = lower(r.input)`,
  );
  const candidateIds = [...new Set(candidates.map((row) => row.id))];
  const holdings =
    candidateIds.length === 0
      ? []
      : await executeRows<{
          person_id: string;
          office_id: string;
          office_type: string;
        }>(
          db,
          sql`SELECT DISTINCT t.person_id::text AS person_id,
                     t.office_id::text AS office_id,
                     o.office_type AS office_type
              FROM terms t
              JOIN offices o ON o.id = t.office_id
              JOIN government_bodies b ON b.id = o.body_id
              WHERE b.jurisdiction_id = ${input.jurisdictionId}::uuid
                AND t.person_id IN (
                  SELECT jsonb_array_elements_text(${JSON.stringify(candidateIds)}::jsonb)::uuid
                )`,
        );
  const officesByPerson = new Map<string, Set<string>>();
  const rosterHolders = new Set<string>();
  for (const row of holdings) {
    const set = officesByPerson.get(row.person_id) ?? new Set<string>();
    set.add(row.office_id);
    officesByPerson.set(row.person_id, set);
    if ((CIA_ROSTER_OFFICE_TYPES as readonly string[]).includes(row.office_type)) {
      rosterHolders.add(row.person_id);
    }
  }
  const candidatesByName = new Map<string, Array<{ id: string; qid: string | null }>>();
  for (const row of candidates) {
    const list = candidatesByName.get(row.input) ?? [];
    if (!list.some((existing) => existing.id === row.id)) {
      list.push({ id: row.id, qid: row.qid });
    }
    candidatesByName.set(row.input, list);
  }

  for (const entry of input.entries) {
    const key = `${entry.title}\u001f${entry.name}`;
    const matches = candidatesByName.get(entry.name) ?? [];
    if (matches.length === 0) {
      const newKey = `${input.jurisdictionId}\u001f${entry.name.toLowerCase()}`;
      let personId = input.newPersonIds.get(newKey);
      if (!personId) {
        personId = input.newId();
        input.newPersonIds.set(newKey, personId);
      }
      resolved.set(key, { personId, isNew: true, name: entry.name });
      continue;
    }
    const officeId = input.officeIdByTitle.get(entry.title);
    const tiers = [
      matches.filter(
        (match) => officeId !== undefined && officesByPerson.get(match.id)?.has(officeId),
      ),
      matches.filter((match) => rosterHolders.has(match.id)),
      matches.filter((match) => officesByPerson.has(match.id)),
      matches.filter((match) => match.qid !== null),
      matches,
    ];
    const deciding = tiers.find((tier) => tier.length > 0) ?? [];
    if (deciding.length !== 1) throw new CabinetPersonIdentityError();
    resolved.set(key, { personId: deciding[0].id, isNew: false, name: entry.name });
  }
  return resolved;
}

// ─── Dry-run plan ────────────────────────────────────────────────────────────

export interface PlannedPosition {
  title: string;
  rawName: string | null;
  normalizedName: string | null;
  order: number;
  category: PositionCategory;
  officeType: string;
}

export interface PlannedCountry {
  slug: string;
  countryName: string | null;
  jurisdictionId: string | null;
  jurisdictionName: string | null;
  lastUpdated: string | null;
  /** ISO form of `lastUpdated`, or null when absent/unparseable. */
  rosterStamp: string | null;
  /** When this page response was retrieved (ISO, UTC). */
  retrievedAt: string | null;
  fetchStatus: number;
  parseFailed: boolean;
  jurisdictionMatched: boolean;
  positions: PlannedPosition[];
}

/** A country skipped because its fetch failed after all retries, its HTTP 200
 * page failed the expected schema, another country-scoped read/parse step
 * threw, or a closed roster/identity guard refused the write. Distinct from a
 * clean 404, which is not a failure — see `computeCabinetPlan`. */
export type CabinetFailureCode =
  | "upstream_http_error"
  | "upstream_schema_error"
  | "country_read_error"
  | "office_identity_conflict"
  | "person_identity_ambiguous"
  | "roster_contraction_guard"
  | "roster_stamp_regressed"
  | "persistence_error";

export interface FailedCountry {
  slug: string;
  code: CabinetFailureCode;
  reason: string;
}

const FAILURE_REASONS: Record<
  Exclude<CabinetFailureCode, "upstream_http_error" | "upstream_schema_error" | "country_read_error">,
  string
> = {
  office_identity_conflict: "Office identity is ambiguous or unsafe",
  person_identity_ambiguous: "Person identity is ambiguous",
  roster_contraction_guard:
    "Roster contraction exceeds the safe automatic retirement limit",
  roster_stamp_regressed: "Roster date is older than the stored roster date",
  persistence_error: "Country persistence failed",
};

function closedCabinetWriteFailure(slug: string, err: unknown): FailedCountry {
  if (err instanceof CabinetPersonIdentityError) {
    return {
      slug,
      code: "person_identity_ambiguous",
      reason: FAILURE_REASONS.person_identity_ambiguous,
    };
  }
  const message = (err as Error)?.message ?? "";
  if (
    message.includes(
      "Office mutation did not resolve one stable row; identity is ambiguous or unsafe",
    ) ||
    message.includes("civica_assertion_failed:office_identity_conflict") ||
    message.includes("terms_office_id_offices_id_fk")
  ) {
    return {
      slug,
      code: "office_identity_conflict",
      reason: FAILURE_REASONS.office_identity_conflict,
    };
  }
  return {
    slug,
    code: "persistence_error",
    reason: FAILURE_REASONS.persistence_error,
  };
}

export interface CabinetPlan {
  countries: PlannedCountry[];
  /** Countries whose fetch/schema/parse/read step failed and were SKIPPED (the
   * crawl continued). Empty on a fully-clean run. */
  failed: FailedCountry[];
  stats: {
    countriesFetched: number;
    countriesParsed: number;
    countriesUnmatched: number;
    countriesFetchFailed: number;
    /** Countries SKIPPED after an upstream/schema/country-read failure (the
     * crawl continued). Counted separately from an expected 404. */
    countriesSkipped: number;
    /** Positions the CIA lists, total across the sample. */
    positionsTotal: number;
    /** Head rows skipped (owned by the Wikidata spine). */
    headsSkipped: number;
    /** Positions that would become offices (everything except heads). */
    positionsIngested: number;
    /** Positions with a named holder → a term. */
    named: number;
    /** Positions with no name (or CIA's "Vacant") → listed office, no term. */
    vacant: number;
    byCategory: Record<PositionCategory, number>;
  };
}

const EMPTY_BY_CATEGORY = (): Record<PositionCategory, number> => ({
  head: 0,
  deputy: 0,
  cabinet: 0,
  central_bank: 0,
  diplomatic: 0,
  other: 0,
});

/**
 * Fetch the sample, parse, and resolve jurisdictions. Pure READ — hits cia.gov
 * (HTML) and reads `jurisdictions`. Person identity is resolved later, per
 * country, against the stored roster it will reconcile. Writes NOTHING.
 */
export async function computeCabinetPlan(
  options: CabinetSyncOptions = {},
): Promise<CabinetPlan> {
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const crawlDelay = options.crawlDelayMs ?? CIA_CRAWL_DELAY_MS;
  const slugs = options.slugs ?? [];

  const plan: CabinetPlan = {
    countries: [],
    failed: [],
    stats: {
      countriesFetched: 0,
      countriesParsed: 0,
      countriesUnmatched: 0,
      countriesFetchFailed: 0,
      countriesSkipped: 0,
      positionsTotal: 0,
      headsSkipped: 0,
      positionsIngested: 0,
      named: 0,
      vacant: 0,
      byCategory: EMPTY_BY_CATEGORY(),
    },
  };

  const recordCountryFailure = (
    slug: string,
    code: CabinetFailureCode,
    reason: string,
  ) => {
    plan.stats.countriesSkipped++;
    plan.failed.push({ slug, code, reason });
  };

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    if (i > 0) await new Promise((r) => setTimeout(r, crawlDelay));

    log(`Fetching ${slug} …`);

    // ── ENTIRE per-country body is guarded ──────────────────────────────────
    // ONE try/catch wraps the whole iteration: the CIA fetch, the
    // `findJurisdictionBySlug` Neon read, and parse. On ANY thrown error
    // (network, Neon ConnectTimeout, parse edge, anything), we log
    // `⚠ skipped <slug>`, push to `failed[]`, and `continue`. NOTHING a single
    // country does may abort the ~194-country crawl. Every per-country Neon
    // call is additionally wrapped in `withDbRetry` so a transient
    // serverless-HTTP blip retries before it ever reaches this catch. Counted
    // once per iteration whether the body succeeds or the catch fires, so a
    // fetch-then-DB-timeout skip isn't double-counted in `countriesFetched`.
    let countedFetched = false;
    try {
      // Resilient fetch: a network/timeout error retries (backoff) internally.
      // A clean 404 is an expected skip (handled below via `ok === false`), NOT
      // a failure; a persistent network error re-throws into the catch below.
      const { ok, status, html } = await fetchCountryResilient(slug, log, {
        fetcher: options.fetchCountryPage,
        wait: options.retryWait,
      });
      const retrievedAt = new Date().toISOString();
      plan.stats.countriesFetched++;
      countedFetched = true;

      const country: PlannedCountry = {
        slug,
        countryName: null,
        jurisdictionId: null,
        jurisdictionName: null,
        lastUpdated: null,
        rosterStamp: null,
        retrievedAt,
        fetchStatus: status,
        parseFailed: false,
        jurisdictionMatched: false,
        positions: [],
      };

      if (!ok) {
        country.parseFailed = true;
        plan.stats.countriesFetchFailed++;
        if (status === 404) {
          // The directory intentionally omits countries that are not foreign
          // governments from the CIA's perspective (notably the United States).
          // This absence is expected and must not poison aggregate success.
          log(`  · ${slug}: not present in CIA World Leaders (HTTP 404)`);
          plan.countries.push(country);
          continue;
        }
        const reason = `CIA World Leaders returned HTTP ${status}`;
        recordCountryFailure(slug, "upstream_http_error", reason);
        log(`! ${slug}: ${reason}`);
        plan.countries.push(country);
        continue;
      }

      const juris = await withDbRetry(
        () => findJurisdictionBySlug(db, slug),
        { log, label: `findJurisdiction(${slug})` },
      );
      country.jurisdictionId = juris?.id ?? null;
      country.jurisdictionName = juris?.name ?? null;
      country.jurisdictionMatched = !!juris;
      if (!juris) plan.stats.countriesUnmatched++;

      const parsed = parseCountryHtml(slug, html);
      country.countryName = parsed.countryName;
      country.lastUpdated = parsed.lastUpdated;
      country.rosterStamp = parseRosterStamp(parsed.lastUpdated);
      country.parseFailed = parsed.parseFailed;
      if (parsed.parseFailed) {
        const reason =
          "CIA World Leaders HTTP 200 page failed the leaders-section schema";
        recordCountryFailure(slug, "upstream_schema_error", reason);
        log(`! ${slug}: ${reason}`);
        plan.countries.push(country);
        continue;
      }
      plan.stats.countriesParsed++;

      for (const pos of parsed.positions) {
        plan.stats.positionsTotal++;
        plan.stats.byCategory[pos.category]++;

        if (pos.category === "head") {
          plan.stats.headsSkipped++;
          continue; // spine owns heads
        }
        plan.stats.positionsIngested++;
        if (pos.rawName) plan.stats.named++;
        else plan.stats.vacant++;

        country.positions.push({
          title: pos.title,
          rawName: pos.rawName,
          normalizedName: pos.rawName ? normalizeCiaName(pos.rawName) : null,
          order: pos.order,
          category: pos.category,
          officeType: officeTypeForCategory(pos.category),
        });
      }

      log(
        `  ✓ ${slug}: ${parsed.positions.length} positions (${country.positions.length} to ingest)`,
      );
      plan.countries.push(country);
    } catch {
      // ANY failure in the per-country body (fetch after retries, a Neon
      // timeout in findJurisdictionBySlug, a parse throw) skips THIS country
      // and records it — the crawl runs to completion.
      if (!countedFetched) plan.stats.countriesFetched++;
      recordCountryFailure(
        slug,
        "country_read_error",
        "Country fetch or read failed",
      );
      log(`! ${slug}: country_read_error`);
      continue;
    }
  }

  return plan;
}

// ─── Dry-run report ──────────────────────────────────────────────────────────

/** Extrapolate a sample average across the full ~195-country directory. */
const FULL_DIRECTORY_COUNT = 195;

export function reportCabinetPlan(
  plan: CabinetPlan,
  log: (line: string) => void = (line) => console.log(line),
): void {
  const s = plan.stats;
  const parsed = s.countriesParsed || 1;
  const avgPerCountry = s.positionsTotal / parsed;
  const avgIngestPerCountry = s.positionsIngested / parsed;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  log("\n========================================================");
  log("  DRY RUN — proposed CIA World Leaders cabinet import");
  log("  (NOTHING written to the database; no db:push)");
  log("========================================================\n");

  log("SAMPLE COVERAGE");
  log(`  Countries fetched:            ${s.countriesFetched}`);
  log(`  → parsed OK:                  ${s.countriesParsed}`);
  log(`  → HTTP non-2xx (e.g. 404):    ${s.countriesFetchFailed}`);
  log(`  → skipped (aggregate failure): ${s.countriesSkipped}`);
  log(`  → no jurisdiction match:      ${s.countriesUnmatched}`);
  if (plan.failed.length > 0) {
    log(`\n  SKIPPED after failures (targeted re-run needed):`);
    for (const f of plan.failed) log(`    ⚠ ${f.slug}: ${f.reason}`);
  }

  log("\nVOLUME (across the parsed sample)");
  log(`  Positions the CIA lists:      ${s.positionsTotal}`);
  log(`  → head rows skipped (spine):  ${s.headsSkipped}`);
  log(`  → positions to ingest:        ${s.positionsIngested}`);
  log(`     · named (→ term):          ${s.named}`);
  log(`     · unnamed or vacant:       ${s.vacant}`);
  log(`  Avg positions / country:      ${avgPerCountry.toFixed(1)}`);
  log(`  Avg ingested / country:       ${avgIngestPerCountry.toFixed(1)}`);

  log("\nBY CATEGORY (office_type tag)");
  for (const cat of [
    "cabinet",
    "central_bank",
    "diplomatic",
    "deputy",
    "other",
    "head",
  ] as PositionCategory[]) {
    const n = s.byCategory[cat];
    const tag = cat === "head" ? "(SKIPPED — spine)" : `→ ${officeTypeForCategory(cat)}`;
    log(
      `  ${cat.padEnd(13)} ${String(n).padStart(4)}  (${pct(
        n,
        s.positionsTotal,
      )}% of listed)  ${tag}`,
    );
  }

  log("\nEXTRAPOLATED TOTAL (× ~195 countries — the scale of \"everything\")");
  log(
    `  Positions listed:   ~${Math.round(avgPerCountry * FULL_DIRECTORY_COUNT).toLocaleString("en-US")}`,
  );
  log(
    `  Offices listed:     ~${Math.round(avgIngestPerCountry * FULL_DIRECTORY_COUNT).toLocaleString("en-US")}`,
  );

  // Per-country samples (first 3 matched countries with positions).
  log("\nSAMPLE — parsed positions → proposed office_type");
  const sampleCountries = plan.countries
    .filter((c) => c.jurisdictionMatched && c.positions.length > 0)
    .slice(0, 3);
  for (const c of sampleCountries) {
    log(
      `\n  ${c.jurisdictionName ?? c.slug}  (Last Updated: ${c.lastUpdated ?? "?"}, ${c.positions.length} positions to ingest)`,
    );
    for (const p of c.positions.slice(0, 16)) {
      const holder = p.normalizedName ?? "(vacant — no holder)";
      log(`    [${p.officeType}] "${p.title}" → ${holder}`);
    }
    if (c.positions.length > 16) {
      log(`    … and ${c.positions.length - 16} more`);
    }
  }

  log("\nAPPLY-PATH WRITE SHAPE (DAT-037 roster reconciliation)");
  log('  · reuse the "Executive of <country>" body; offices keyed on exact title');
  log("  · titles no longer listed release their list position; holders retire");
  log("  · current holders of each listed title = exactly the listed people");
  log("  · terms keyed on (office, person); no start date is ever written");
  log(
    `  · one '${CABINET_MEMBER_PREDICATE}' statement per term and one '${CABINET_ROSTER_PREDICATE}' statement per country (source '${CIA_WORLD_LEADERS_SOURCE_ID}')`,
  );
  log("  · unchanged rosters write nothing and do not stamp freshness");
  log("");
}

// ─── CIA slug enumeration (the full ~194-country crawl list) ─────────────────
//
// The CIA World Leaders index paginates client-side (a plain fetch only returns
// the first alphabetical page), so we cannot scrape the authoritative list. We
// instead derive CIA candidate slugs from Civica's own sovereign jurisdictions
// (Factbook-derived slugs, which mostly match the CIA World Leaders slugs) and
// apply a small override map for the confirmed divergences. The crawl is
// 404-tolerant: any candidate the CIA does not publish (dependencies,
// uninhabited territories, non-foreign-government entries) simply fetch-fails
// and is skipped — never a partial write.

/**
 * Civica jurisdiction slug → CIA World Leaders slug, for the confirmed
 * divergences. Defined with the roster contract (`cabinet-roster.ts`) so the
 * one-time repair maps pages to jurisdictions exactly as the importer does.
 */
export { CIA_SLUG_OVERRIDES };

/**
 * Civica jurisdiction slugs that are NOT foreign sovereign governments in the
 * CIA World Leaders sense (the crawl skips them up front rather than eating a
 * 10s crawl-delay on a guaranteed 404):
 *   - `united-states` — the directory is FOREIGN governments only (404).
 *   - uninhabited / feature territories and dependencies with no cabinet.
 * Dependencies that DO have a World Leaders page (e.g. Hong Kong, Aruba) are
 * NOT in this list — they resolve normally. When in doubt we keep the slug and
 * let the fetch 404 harmlessly; this list only prunes the obvious noise.
 */
const CIA_SKIP_SLUGS = new Set<string>([
  "united-states",
  "antarctica",
  "ashmore-and-cartier-islands",
  "baker-island-howland-island-jarvis-island-johnston-atoll-kingman-reef-midway-islands-palmyra-atoll",
  "bouvet-island",
  "clipperton-island",
  "coral-sea-islands",
  "heard-island-and-mcdonald-islands",
  "jan-mayen",
  "navassa-island",
  "paracel-islands",
  "spratly-islands",
  "south-georgia-and-south-sandwich-islands",
  "french-southern-and-antarctic-lands",
  "svalbard-sometimes-referred-to-as-spitsbergen-the-largest-island-in-the-archipelago",
  "wake-island",
]);

/**
 * Build the full CIA-slug crawl list from every Civica sovereign jurisdiction,
 * applying `CIA_SLUG_OVERRIDES` and pruning `CIA_SKIP_SLUGS`. Returns
 * `{ ciaSlug }[]`; `computeCabinetPlan`'s `findJurisdictionBySlug` maps each CIA
 * slug back to the Civica jurisdiction (it tries the slug, then the override's
 * reverse, then a name match).
 */
export async function buildCiaSlugList(
  db: CabinetSyncDb = sharedDb,
): Promise<string[]> {
  const rows = await db
    .select({ slug: jurisdictions.slug })
    .from(jurisdictions);
  const out: string[] = [];
  for (const { slug } of rows) {
    if (CIA_SKIP_SLUGS.has(slug)) continue;
    out.push(CIA_SLUG_OVERRIDES[slug] ?? slug);
  }
  return out.sort();
}

// The override map is our-slug → cia-slug; `findJurisdictionBySlug` needs the
// reverse to resolve a CIA slug back to the Civica jurisdiction when the CIA
// slug differs from ours. Kept here next to the forward map so they can't drift.
const CIA_SLUG_TO_JURIS_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CIA_SLUG_OVERRIDES).map(([ours, cia]) => [cia, ours]),
);

// ─── Apply path (DAT-037 roster reconciliation) ──────────────────────────────

/**
 * Categories persisted by the apply path. Owner scope decision (2026-07-01):
 * cabinet + central-bank + deputy + other; DROP `diplomatic`
 * (Ambassador-to-US / UN-rep). `head` is always skipped (the QID-backed
 * Wikidata spine owns heads).
 */
const INGEST_CATEGORIES: ReadonlySet<PositionCategory> = new Set([
  "cabinet",
  "central_bank",
  "deputy",
  "other",
]);

/** Methodology label recorded on every Atlas entity event this path writes. */
export const CIA_CABINET_METHODOLOGY_VERSION = "cia-world-leaders-sync/v2";

interface ExecutiveBodyRow {
  id: string;
  name: string;
  body_type: string;
  branch: string | null;
  hierarchy_level: number | null;
}

class CabinetExecutiveBodyConflictError extends Error {
  constructor() {
    super(
      "Office mutation did not resolve one stable row; identity is ambiguous or unsafe",
    );
    this.name = "CabinetExecutiveBodyConflictError";
  }
}

/**
 * Read one country's stored executive roster: its executive body, every
 * office in that body, the terms on roster-typed offices with their own CIA
 * statement, and the body-level roster statement.
 */
export async function readCountryRosterState(
  db: CabinetSyncDb,
  jurisdictionId: string,
): Promise<{ body: ExecutiveBodyRow | null; state: CountryRosterState }> {
  const bodies = await executeRows<ExecutiveBodyRow>(
    db,
    sql`SELECT id::text AS id, name, body_type, branch, hierarchy_level
        FROM government_bodies
        WHERE jurisdiction_id = ${jurisdictionId}::uuid AND branch = 'executive'
        ORDER BY id`,
  );
  if (bodies.length > 1) throw new CabinetExecutiveBodyConflictError();
  const body = bodies[0] ?? null;
  if (!body) {
    return { body: null, state: { offices: [], terms: [], rosterStatement: null } };
  }
  const officeRows = await executeRows<{
    id: string;
    name: string;
    office_type: string;
    display_order: number | null;
    is_elected: boolean | null;
  }>(
    db,
    sql`SELECT id::text AS id, name, office_type, display_order, is_elected
        FROM offices WHERE body_id = ${body.id}::uuid ORDER BY id`,
  );
  const termRows = await executeRows<{
    id: string;
    office_id: string;
    person_id: string;
    is_current: boolean | null;
    start_date: string | null;
    statement_id: string | null;
    object_value: string | null;
    source_url: string | null;
    source_license: string | null;
    retrieved_at: string | null;
  }>(
    db,
    sql`SELECT t.id::text AS id, t.office_id::text AS office_id,
               t.person_id::text AS person_id, t.is_current,
               t.start_date::text AS start_date, s.id::text AS statement_id,
               s.object_value, s.source_url, s.source_license,
               s.retrieved_at::text AS retrieved_at
        FROM terms t
        JOIN offices o ON o.id = t.office_id
        LEFT JOIN statements s
          ON s.subject_table = 'terms' AND s.subject_id = t.id
         AND s.predicate = ${CABINET_MEMBER_PREDICATE}
         AND s.source_id = ${CIA_WORLD_LEADERS_SOURCE_ID}
        WHERE o.body_id = ${body.id}::uuid
          AND o.office_type IN (
            SELECT jsonb_array_elements_text(${JSON.stringify(CIA_ROSTER_OFFICE_TYPES)}::jsonb)
          )
        ORDER BY t.id`,
  );
  const rosterRows = await executeRows<{
    id: string;
    object_value: string | null;
    source_hash: string | null;
    source_url: string | null;
    source_license: string | null;
  }>(
    db,
    sql`SELECT id::text AS id, object_value, source_hash, source_url, source_license
        FROM statements
        WHERE subject_table = 'government_bodies'
          AND subject_id = ${body.id}::uuid
          AND predicate = ${CABINET_ROSTER_PREDICATE}
          AND source_id = ${CIA_WORLD_LEADERS_SOURCE_ID}`,
  );
  const roster = rosterRows[0] ?? null;
  return {
    body,
    state: {
      offices: officeRows.map((row) => ({
        id: row.id,
        name: row.name,
        officeType: row.office_type,
        displayOrder: row.display_order,
        isElected: row.is_elected,
      })),
      terms: termRows.map((row) => ({
        id: row.id,
        officeId: row.office_id,
        personId: row.person_id,
        isCurrent: row.is_current,
        startDate: row.start_date,
        cia: row.statement_id
          ? {
              statementId: row.statement_id,
              objectValue: row.object_value,
              sourceUrl: row.source_url,
              sourceLicense: row.source_license,
              retrievedAt: row.retrieved_at,
            }
          : null,
      })),
      rosterStatement: roster
        ? {
            id: roster.id,
            objectValue: roster.object_value,
            sourceHash: roster.source_hash,
            sourceUrl: roster.source_url,
            sourceLicense: roster.source_license,
          }
        : null,
    },
  };
}

/** Group eligible positions by exact title, keeping publisher order. */
export function groupRosterTitles(
  positions: readonly PlannedPosition[],
  holders: ReadonlyMap<string, RosterHolder>,
): RosterTitle[] {
  const byTitle = new Map<string, RosterTitle>();
  for (const position of positions) {
    let title = byTitle.get(position.title);
    if (!title) {
      title = {
        title: position.title,
        officeType: position.officeType,
        firstOrder: position.order,
        holders: [],
      };
      byTitle.set(position.title, title);
    }
    if (!position.normalizedName) continue;
    const holder = holders.get(`${position.title}\u001f${position.normalizedName}`);
    if (!holder) {
      throw new Error("Cabinet roster holder was not resolved before planning");
    }
    if (!title.holders.some((existing) => existing.personId === holder.personId)) {
      title.holders.push(holder);
    }
  }
  return [...byTitle.values()];
}

interface CountryBatchInput {
  db: CabinetSyncDb;
  bodyId: string;
  bodyWrite: SQL | null;
  plan: CountryRosterPlan;
  sourceUrl: string;
  retrievedAt: string;
  history: GovernmentEntityHistoryContext;
}

/**
 * Build one country's writes as an ordered, non-interactive Neon transaction.
 * Every term and statement write is idempotent (guarded updates, conflict-safe
 * inserts), so a replay after an unknown commit outcome writes nothing new.
 * The final assertion raises, rolling the whole country back, unless every
 * listed and released office ended in its planned position.
 */
export function buildCountryRosterBatch(input: CountryBatchInput): SQL[] {
  const { plan, bodyId } = input;
  const statementsOut: SQL[] = [];
  if (input.bodyWrite) statementsOut.push(input.bodyWrite);

  const releaseHistory: GovernmentEntityHistoryContext = {
    ...input.history,
    reason: "No longer listed in the CIA World Leaders roster",
  };
  const order = { release: 0, move: 1, insert: 2 } as const;
  for (const write of [...plan.officeWrites].sort(
    (a, b) => order[a.kind] - order[b.kind],
  )) {
    statementsOut.push(
      write.kind === "insert"
        ? buildOfficeHistoryStatement(
            {
              bodyId,
              name: write.name,
              officeType: write.officeType,
              isElected: write.isElected,
              displayOrder: write.displayOrder,
              identityMode: "exact_title",
              history: input.history,
            },
            write.officeId,
          )
        : buildOfficeHistoryStatement({
            bodyId,
            stableId: write.officeId,
            name: write.name,
            officeType: write.officeType,
            isElected: write.isElected,
            displayOrder: write.displayOrder,
            identityMode: "exact_title",
            history: write.kind === "release" ? releaseHistory : input.history,
          }),
    );
  }

  for (const person of plan.personInserts) {
    statementsOut.push(
      buildPersonHistoryStatement(
        {
          stableId: person.personId,
          insertName: person.name,
          values: { name: person.name, wikidataQid: null },
          history: input.history,
        },
        person.personId,
      ),
    );
  }

  if (plan.termsRetired.length > 0) {
    statementsOut.push(sql`
      UPDATE terms SET is_current = false
      WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(plan.termsRetired)}::jsonb)::uuid)
        AND is_current IS DISTINCT FROM false`);
  }
  if (plan.termsReinstated.length > 0) {
    statementsOut.push(sql`
      UPDATE terms SET is_current = true
      WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(plan.termsReinstated)}::jsonb)::uuid)
        AND is_current IS DISTINCT FROM true`);
  }
  if (plan.termInserts.length > 0) {
    // Undated listing: CIA publishes no appointment date, so none is stored.
    statementsOut.push(sql`
      INSERT INTO terms (id, office_id, person_id, start_date, end_date, is_current)
      SELECT x."termId", x."officeId", x."personId", NULL, NULL, true
      FROM jsonb_to_recordset(${JSON.stringify(plan.termInserts)}::jsonb)
        AS x("termId" uuid, "officeId" uuid, "personId" uuid)
      ON CONFLICT (id) DO NOTHING`);
  }
  if (plan.statementWrites.length > 0) {
    const rows = plan.statementWrites.map(({ termId, objectValue }) => ({
      subjectId: termId,
      objectValue,
    }));
    // `retrieved_at` records the retrieval that established this content; an
    // unchanged statement is left untouched.
    statementsOut.push(sql`
      INSERT INTO statements (
        subject_table, subject_id, predicate, object_value, source_id,
        source_url, source_license, retrieved_at
      )
      SELECT 'terms', x."subjectId", ${CABINET_MEMBER_PREDICATE}, x."objectValue",
             ${CIA_WORLD_LEADERS_SOURCE_ID}, ${input.sourceUrl}, ${CIA_ROSTER_LICENSE},
             ${input.retrievedAt}::timestamp
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS x("subjectId" uuid, "objectValue" text)
      ON CONFLICT (subject_table, subject_id, predicate, source_id) DO UPDATE SET
        object_value = EXCLUDED.object_value,
        source_url = EXCLUDED.source_url,
        source_license = EXCLUDED.source_license,
        retrieved_at = EXCLUDED.retrieved_at
      WHERE (statements.object_value, statements.source_url, statements.source_license)
        IS DISTINCT FROM (EXCLUDED.object_value, EXCLUDED.source_url, EXCLUDED.source_license)`);
  }
  if (plan.rosterStatement) {
    statementsOut.push(sql`
      INSERT INTO statements (
        subject_table, subject_id, predicate, object_value, source_id,
        source_url, source_license, retrieved_at, source_hash
      )
      VALUES (
        'government_bodies', ${bodyId}::uuid, ${CABINET_ROSTER_PREDICATE},
        ${plan.rosterStatement.objectValue}, ${CIA_WORLD_LEADERS_SOURCE_ID},
        ${input.sourceUrl}, ${CIA_ROSTER_LICENSE}, ${input.retrievedAt}::timestamp,
        ${plan.rosterStatement.sourceHash}
      )
      ON CONFLICT (subject_table, subject_id, predicate, source_id) DO UPDATE SET
        object_value = EXCLUDED.object_value,
        source_url = EXCLUDED.source_url,
        source_license = EXCLUDED.source_license,
        source_hash = EXCLUDED.source_hash,
        retrieved_at = EXCLUDED.retrieved_at
      WHERE (statements.object_value, statements.source_hash, statements.source_url, statements.source_license)
        IS DISTINCT FROM (EXCLUDED.object_value, EXCLUDED.source_hash, EXCLUDED.source_url, EXCLUDED.source_license)`);
  }

  const expectedOffices = [
    ...plan.listedOffices,
    ...plan.releasedOfficeIds.map((officeId) => ({
      officeId,
      name:
        plan.officeWrites.find((write) => write.officeId === officeId)?.name ?? "",
      displayOrder: null,
    })),
  ];
  if (expectedOffices.length > 0) {
    // A blocked office write (for example the shared writer's same-position
    // rename guard) leaves no row; this raises and rolls the country back.
    statementsOut.push(sql`
      SELECT CASE WHEN x.mismatches = 0 THEN 1
        ELSE ('civica_assertion_failed:office_identity_conflict:' || x.mismatches::text)::integer
      END AS verified
      FROM (
        SELECT count(*)::integer AS mismatches
        FROM jsonb_to_recordset(${JSON.stringify(expectedOffices)}::jsonb)
          AS e("officeId" uuid, name text, "displayOrder" integer)
        LEFT JOIN offices o ON o.id = e."officeId" AND o.body_id = ${bodyId}::uuid
        WHERE o.id IS NULL
           OR o.name IS DISTINCT FROM e.name
           OR o.display_order IS DISTINCT FROM e."displayOrder"
      ) x`);
  }
  return statementsOut;
}

async function executeCountryBatch(
  db: CabinetSyncDb,
  statementsIn: readonly SQL[],
): Promise<void> {
  if (statementsIn.length === 0) return;
  const queries = statementsIn.map((statement) => db.execute(statement));
  const [first, ...rest] = queries;
  await db.batch([first, ...rest] as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}

export interface CiaCabinetSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  countriesCrawled: number;
  /** Countries whose roster changed and was written (or would be, dry run). */
  countriesApplied: number;
  /** Countries whose roster was reconciled, including unchanged ones. */
  countriesVerified: number;
  /** Verified countries whose stored roster already matched the page. */
  countriesUnchanged: number;
  countriesFetchFailed: number;
  /** Countries skipped after an upstream/schema/read/guard/write failure. */
  countriesSkipped: number;
  /** The skipped slugs + reasons, so a targeted re-run can pick up stragglers. */
  skipped: FailedCountry[];
  countriesUnmatched: number;
  bodiesWritten: number;
  /** Office rows changed: released + moved + inserted. */
  officesWritten: number;
  officesReleased: number;
  officesMoved: number;
  officesInserted: number;
  /** Listed holders matched to an existing person (a read, not a write). */
  personsExisting: number;
  /** Retained for response compatibility; the crawl never creates QID persons. */
  personsQidCreated: number;
  /** QID-less persons created for names with no stored match. */
  personsIdlessCreated: number;
  /** Term rows changed: inserted + reinstated + retired. */
  termsWritten: number;
  termsInserted: number;
  termsReinstated: number;
  termsRetired: number;
  /** Listed titles with no holder (CIA's "Vacant" or an unnamed post). */
  vacantOffices: number;
  diplomaticSkipped: number;
  /** Statement rows changed: term inserts + term updates + roster writes. */
  statementsWritten: number;
  statementsInserted: number;
  statementsUpdated: number;
  rosterStatementsWritten: number;
  /** Pages without a parseable "Last Updated" date (roster date kept). */
  rosterStampMissing: number;
  /** Every real row mutation this run (zero for an unchanged shard). */
  totalRowsWritten: number;
  freshnessStamped: boolean;
  dryRun: boolean;
}

/**
 * The CIA World Leaders cabinet apply. Reuses `computeCabinetPlan` (the exact
 * fetch/parse the dry run reported on), then, country by country, reconciles
 * the stored roster with the page and commits each country's writes in one
 * transaction. Stamps `markSourcesSynced("cia_world_leaders")` only when rows
 * actually changed and no country was skipped.
 *
 * `slugs` defaults to the full `buildCiaSlugList()` crawl (~194 candidates,
 * 404-tolerant). The cron route and the CLI both call this. QID attachment is
 * the separate, deferred `backfillCabinetQids()` pass.
 */
export async function syncCiaCabinets(
  options: CabinetSyncOptions = {},
): Promise<CiaCabinetSyncSummary> {
  // Validate the history identity before selecting slugs, crawling CIA, or
  // reading/writing the database. Dry runs exercise this same configuration
  // boundary so they cannot report a healthy preview for an apply that would
  // fail only after the crawl completes.
  const atlasReleaseId = resolveAtlasReleaseId(options.atlasReleaseId);
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const newId = options.newId ?? randomUUID;
  const dryRun = options.dryRun ?? false;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const slugs = options.slugs ?? (await buildCiaSlugList(db));
  log(`=== CIA World Leaders Cabinet Sync (${dryRun ? "DRY RUN" : "APPLY"}) ===`);
  log(`Crawling ${slugs.length} CIA candidate pages …`);

  const plan = options.plan ?? await computeCabinetPlan({
    db,
    slugs,
    crawlDelayMs: options.crawlDelayMs,
    onProgress: log,
    fetchCountryPage: options.fetchCountryPage,
    retryWait: options.retryWait,
  });

  const summary: CiaCabinetSyncSummary = {
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    countriesCrawled: plan.stats.countriesFetched,
    countriesApplied: 0,
    countriesVerified: 0,
    countriesUnchanged: 0,
    countriesFetchFailed: plan.stats.countriesFetchFailed,
    countriesSkipped: plan.stats.countriesSkipped,
    skipped: [...plan.failed],
    countriesUnmatched: plan.stats.countriesUnmatched,
    bodiesWritten: 0,
    officesWritten: 0,
    officesReleased: 0,
    officesMoved: 0,
    officesInserted: 0,
    personsExisting: 0,
    personsQidCreated: 0,
    personsIdlessCreated: 0,
    termsWritten: 0,
    termsInserted: 0,
    termsReinstated: 0,
    termsRetired: 0,
    vacantOffices: 0,
    diplomaticSkipped: 0,
    statementsWritten: 0,
    statementsInserted: 0,
    statementsUpdated: 0,
    rosterStatementsWritten: 0,
    rosterStampMissing: 0,
    totalRowsWritten: 0,
    freshnessStamped: false,
    dryRun,
  };
  const history: GovernmentEntityHistoryContext = {
    changeKind: "routine_refresh",
    reason: "CIA World Leaders government roster refresh",
    methodologyVersion: CIA_CABINET_METHODOLOGY_VERSION,
    releaseId: atlasReleaseId,
  };
  const newPersonIds = new Map<string, string>();

  log(`=== Reconciling stored rosters with the CIA pages ===`);
  for (const country of plan.countries) {
    if (!country.jurisdictionMatched || !country.jurisdictionId) continue;
    if (country.parseFailed) continue;
    const jurisdictionId = country.jurisdictionId;

    // Guard the ENTIRE per-country body: a read, identity guard, or write
    // failure skips THIS country (recorded in `skipped[]`) and the run
    // continues. Each country's writes commit atomically or not at all.
    try {
      const sourceUrl = `${CIA_BASE}/${country.slug}/`;
      const retrievedAt = country.retrievedAt ?? new Date().toISOString();
      let diplomatic = 0;
      const eligible = country.positions.filter((pos) => {
        if (pos.category === "diplomatic") {
          diplomatic++;
          return false;
        }
        return INGEST_CATEGORIES.has(pos.category);
      });

      const { body, state } = await withDbRetry(
        () => readCountryRosterState(db, jurisdictionId),
        { log, label: `readRoster(${country.slug})` },
      );
      const officeIdByTitle = new Map(
        state.offices
          .filter((office) =>
            (CIA_ROSTER_OFFICE_TYPES as readonly string[]).includes(office.officeType),
          )
          .map((office) => [office.name, office.id]),
      );
      const holders = await withDbRetry(
        () =>
          resolveRosterPersons(db, {
            jurisdictionId,
            entries: eligible
              .filter((pos) => pos.normalizedName)
              .map((pos) => ({ title: pos.title, name: pos.normalizedName as string })),
            officeIdByTitle,
            newPersonIds,
            newId,
          }),
        { log, label: `resolvePersons(${country.slug})` },
      );
      const titles = groupRosterTitles(eligible, holders);
      const rosterPlan = planCountryRoster({
        titles,
        rosterStamp: country.rosterStamp,
        rosterHash: rosterContentHash(
          eligible.map((pos) => ({ title: pos.title, holder: pos.normalizedName })),
        ),
        sourceUrl,
        state,
        newId,
      });
      if (rosterPlan.guard) {
        summary.countriesSkipped++;
        summary.skipped.push({
          slug: country.slug,
          code: rosterPlan.guard,
          reason: FAILURE_REASONS[rosterPlan.guard],
        });
        log(`! ${country.slug}: ${rosterPlan.guard}`);
        continue;
      }

      // The executive body is shared with the Wikidata officeholder sync,
      // which names it from the Wikidata state label. The roster only needs
      // the body to exist, so an existing body is never rewritten here (the
      // former unconditional upsert renamed it back and forth).
      const bodyId = body?.id ?? newId();
      const bodyWrite = body
        ? null
        : buildGovernmentBodyHistoryStatement(
            {
              jurisdictionId,
              name: `Executive of ${
                country.jurisdictionName ?? country.countryName ?? country.slug
              }`,
              bodyType: "cabinet",
              branch: "executive",
              hierarchyLevel: 0,
              history,
            },
            bodyId,
          );

      const released = rosterPlan.officeWrites.filter((w) => w.kind === "release").length;
      const moved = rosterPlan.officeWrites.filter((w) => w.kind === "move").length;
      const inserted = rosterPlan.officeWrites.filter((w) => w.kind === "insert").length;
      const statementInserts = rosterPlan.statementWrites.filter((w) => w.kind === "insert").length;
      const statementUpdates = rosterPlan.statementWrites.length - statementInserts;
      const mutations = rosterPlan.mutationCount + (bodyWrite ? 1 : 0);

      if (mutations > 0 && !dryRun) {
        const batch = buildCountryRosterBatch({
          db,
          bodyId,
          bodyWrite,
          plan: rosterPlan,
          sourceUrl,
          retrievedAt,
          history,
        });
        await withDbRetry(() => executeCountryBatch(db, batch), {
          log,
          label: `commitRoster(${country.slug})`,
        });
      }

      // Counters record committed (or, for a dry run, planned) mutations only.
      summary.countriesVerified++;
      summary.diplomaticSkipped += diplomatic;
      summary.vacantOffices += titles.filter((title) => title.holders.length === 0).length;
      summary.personsExisting += titles
        .flatMap((title) => title.holders)
        .filter((holder) => !holder.isNew).length;
      if (rosterPlan.rosterStampMissing) summary.rosterStampMissing++;
      if (mutations === 0) {
        summary.countriesUnchanged++;
        continue;
      }
      summary.countriesApplied++;
      summary.bodiesWritten += bodyWrite ? 1 : 0;
      summary.officesReleased += released;
      summary.officesMoved += moved;
      summary.officesInserted += inserted;
      summary.personsIdlessCreated += rosterPlan.personInserts.length;
      summary.termsInserted += rosterPlan.termInserts.length;
      summary.termsReinstated += rosterPlan.termsReinstated.length;
      summary.termsRetired += rosterPlan.termsRetired.length;
      summary.statementsInserted += statementInserts;
      summary.statementsUpdated += statementUpdates;
      summary.rosterStatementsWritten += rosterPlan.rosterStatement ? 1 : 0;
      summary.totalRowsWritten += mutations;
      log(`  ✓ ${country.jurisdictionName ?? country.slug}: ${mutations} row change(s)`);
    } catch (err) {
      // A country-scoped failure records a closed diagnostic and continues.
      // Raw database errors, SQL, and person data never enter the summary or
      // progress logs.
      summary.countriesSkipped++;
      const failure = closedCabinetWriteFailure(country.slug, err);
      summary.skipped.push(failure);
      log(`! ${country.slug}: ${failure.code}`);
      continue;
    }
  }

  summary.officesWritten =
    summary.officesReleased + summary.officesMoved + summary.officesInserted;
  summary.termsWritten =
    summary.termsInserted + summary.termsReinstated + summary.termsRetired;
  summary.statementsWritten =
    summary.statementsInserted +
    summary.statementsUpdated +
    summary.rosterStatementsWritten;

  if (!dryRun) {
    const stamped = await (options.markSynced ?? markSourcesSynced)(
      CIA_WORLD_LEADERS_SOURCE_ID,
      {
        rowsWritten: summary.skipped.length === 0 ? summary.totalRowsWritten : 0,
        executor: db,
      },
    );
    summary.freshnessStamped = stamped.length > 0;
  }

  const finishedAtMs = Date.now();
  summary.finishedAt = new Date(finishedAtMs).toISOString();
  summary.durationMs = finishedAtMs - startedAtMs;

  log(`=== CIA Cabinet Sync Complete${dryRun ? " (DRY RUN — nothing written)" : ""} ===`);
  log(`Countries crawled:        ${summary.countriesCrawled}`);
  log(`Countries verified:       ${summary.countriesVerified}`);
  log(`  · unchanged:            ${summary.countriesUnchanged}`);
  log(`  · changed:              ${summary.countriesApplied}`);
  log(`Countries skipped (fail): ${summary.countriesSkipped}`);
  log(`HTTP non-2xx (e.g. 404):  ${summary.countriesFetchFailed}`);
  log(`Offices released/moved/inserted: ${summary.officesReleased}/${summary.officesMoved}/${summary.officesInserted}`);
  log(`Listed vacant titles:     ${summary.vacantOffices}`);
  log(`Terms inserted/reinstated/retired: ${summary.termsInserted}/${summary.termsReinstated}/${summary.termsRetired}`);
  log(`Persons — existing:       ${summary.personsExisting}`);
  log(`Persons — ID-less new:    ${summary.personsIdlessCreated}`);
  log(`Diplomatic dropped:       ${summary.diplomaticSkipped}`);
  log(`Statements inserted/updated/roster: ${summary.statementsInserted}/${summary.statementsUpdated}/${summary.rosterStatementsWritten}`);
  log(`Total rows written:       ${summary.totalRowsWritten}`);
  log(`Freshness stamped:        ${summary.freshnessStamped}`);
  if (summary.skipped.length > 0) {
    log(
      `\n⚠ ${summary.skipped.length} country(ies) skipped after failures — the crawl still completed:`,
    );
    for (const f of summary.skipped) log(`    ${f.slug}: ${f.code}`);
    log(
      `  Re-run to pick up the stragglers (unchanged countries write nothing): [${summary.skipped.map((f) => f.slug).join(", ")}]`,
    );
  } else {
    log(`\n✓ All crawled countries completed (no skips).`);
  }

  return summary;
}

// ─── Deferred QID backfill (decoupled from the crawl) ────────────────────────
//
// Owner decision 1 (2026-07-01): the crawl creates cia-sourced persons ID-less
// (`wikidata_qid = null`) and QID attachment is a SEPARATE, deferred pass. This
// is that pass. It finds cia-sourced ID-less persons, does the Wikidata
// label+country search (~11s each), and attaches a QID only when confident.
// Throttled, batch-limited, and resumable — safe to run repeatedly off the
// critical path. Runs SLOWLY on purpose (default 1.2s between lookups); DO NOT
// wire it into the crawl.

/** Default throttle between Wikidata lookups in the backfill (ms). */
const BACKFILL_THROTTLE_MS = 1_200;

/** Default number of persons processed per backfill invocation. */
const BACKFILL_DEFAULT_BATCH = 50;

export interface BackfillQidsOptions {
  db?: CabinetSyncDb;
  onProgress?: (line: string) => void;
  /**
   * Max number of ID-less cia-sourced persons to process this run. Keeps each
   * invocation bounded so the backfill is resumable — re-run to continue.
   * Defaults to 50.
   */
  limit?: number;
  /** Throttle between Wikidata lookups (ms). Defaults to 1.2s. */
  throttleMs?: number;
  /**
   * When true, resolve QIDs and report what WOULD attach, but write nothing.
   */
  dryRun?: boolean;
  atlasReleaseId?: string;
  entityWriters?: GovernmentEntityHistoryWriters;
}

export interface BackfillQidsSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** ID-less cia-sourced persons still needing a QID before this run. */
  candidatesRemaining: number;
  /** Persons examined this run (bounded by `limit`). */
  processed: number;
  /** QIDs resolved by the Wikidata search. */
  resolved: number;
  /** QIDs actually attached (resolved, not already taken, not a dry run). */
  attached: number;
  /** Resolved QIDs skipped because another person already carries that QID. */
  skippedQidTaken: number;
  /** Persons the search returned no confident QID for. */
  unresolved: number;
  dryRun: boolean;
  freshnessStamped: boolean;
}

/**
 * Select cia-sourced persons that still lack a Wikidata QID.
 *
 * "cia-sourced" = a person who is the subject of a `cabinet_member` statement
 * sourced to `cia_world_leaders` (the convention `upsertCabinetStatement`
 * writes: `subject_table='terms'`, `subject_id = <term id>`). Ordered by
 * `persons.id` so paging is stable across resumable runs. `limit=0` counts
 * only (returns []).
 */
async function selectIdlessCiaPersons(
  db: CabinetSyncDb,
  limit: number,
): Promise<Array<{ id: string; name: string }>> {
  if (limit <= 0) return [];
  return db
    .selectDistinct({ id: persons.id, name: persons.name })
    .from(persons)
    .innerJoin(terms, eq(terms.personId, persons.id))
    .innerJoin(
      statements,
      and(
        eq(statements.subjectTable, "terms"),
        eq(statements.subjectId, terms.id),
        eq(statements.predicate, "cabinet_member"),
        eq(statements.sourceId, CIA_WORLD_LEADERS_SOURCE_ID),
      ),
    )
    .where(isNull(persons.wikidataQid))
    .orderBy(persons.id)
    .limit(limit);
}

/** Count cia-sourced persons still lacking a QID (for the summary). */
async function countIdlessCiaPersons(db: CabinetSyncDb): Promise<number> {
  const rows = await db
    .select({ id: persons.id })
    .from(persons)
    .innerJoin(terms, eq(terms.personId, persons.id))
    .innerJoin(
      statements,
      and(
        eq(statements.subjectTable, "terms"),
        eq(statements.subjectId, terms.id),
        eq(statements.predicate, "cabinet_member"),
        eq(statements.sourceId, CIA_WORLD_LEADERS_SOURCE_ID),
      ),
    )
    .where(isNull(persons.wikidataQid))
    .groupBy(persons.id);
  return rows.length;
}

/**
 * Deferred QID backfill for cia-sourced ID-less persons. Finds a bounded batch,
 * runs the Wikidata `wbsearchentities` search for each (throttled), and
 * attaches a QID when confident — but NEVER when another person already carries
 * that QID (no fuzzy-merge, no QID collisions). Idempotent + resumable: an
 * attached person drops out of the candidate set, so re-running continues where
 * the last run left off. Stamps freshness only when it actually wrote a QID.
 *
 * DO NOT run this inside the crawl — it is the slow, off-critical-path pass.
 * Invoke via `scripts/sync-cia-cabinets.ts --backfill-qids` (optionally with
 * `--limit=<n>`, `--dry-run`).
 */
export async function backfillCabinetQids(
  options: BackfillQidsOptions = {},
): Promise<BackfillQidsSummary> {
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const limit = options.limit ?? BACKFILL_DEFAULT_BATCH;
  const throttle = options.throttleMs ?? BACKFILL_THROTTLE_MS;
  const dryRun = options.dryRun ?? false;
  const writers = options.entityWriters ?? governmentEntityHistoryWriters;
  const atlasReleaseId = dryRun
    ? null
    : resolveAtlasReleaseId(options.atlasReleaseId);
  const history: GovernmentEntityHistoryContext | null = atlasReleaseId
    ? {
        changeKind: "routine_refresh",
        reason: "CIA cabinet person Wikidata identity backfill",
        methodologyVersion: "cia-person-qid-backfill/v1",
        releaseId: atlasReleaseId,
      }
    : null;

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const candidatesRemaining = await countIdlessCiaPersons(db);
  const batch = await selectIdlessCiaPersons(db, limit);

  log(`=== CIA Cabinet QID Backfill${dryRun ? " (DRY RUN)" : ""} ===`);
  log(
    `ID-less cia-sourced persons: ${candidatesRemaining} · processing ${batch.length} this run`,
  );

  const summary: BackfillQidsSummary = {
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    candidatesRemaining,
    processed: 0,
    resolved: 0,
    attached: 0,
    skippedQidTaken: 0,
    unresolved: 0,
    dryRun,
    freshnessStamped: false,
  };

  for (let i = 0; i < batch.length; i++) {
    const person = batch[i];
    if (i > 0) await new Promise((r) => setTimeout(r, throttle));
    summary.processed++;

    const qid = await searchWikidataPersonQid(person.name);
    if (!qid) {
      summary.unresolved++;
      log(`  · ${person.name}: no confident QID`);
      continue;
    }
    summary.resolved++;

    // Never create a QID collision: if another person already carries this
    // QID, skip (do NOT merge — that is a separate, deliberate operation).
    const taken = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.wikidataQid, qid), sql`${persons.id} <> ${person.id}`))
      .limit(1);
    if (taken.length > 0) {
      summary.skippedQidTaken++;
      log(`  · ${person.name}: ${qid} already held by another person — skipped`);
      continue;
    }

    if (dryRun) {
      log(`  → ${person.name}: would attach ${qid}`);
      continue;
    }

    await writers.mutatePerson(db, {
      stableId: person.id,
      identityQid: qid,
      insertName: person.name,
      values: { wikidataQid: qid },
      history: history!,
    });
    summary.attached++;
    log(`  ✓ ${person.name}: attached ${qid}`);
  }

  const stamped = await markSourcesSynced(CIA_WORLD_LEADERS_SOURCE_ID, {
    rowsWritten: summary.attached,
    dryRun,
    executor: db,
  });
  summary.freshnessStamped = stamped.length > 0;

  const finishedAtMs = Date.now();
  summary.finishedAt = new Date(finishedAtMs).toISOString();
  summary.durationMs = finishedAtMs - startedAtMs;

  log(`=== QID Backfill Complete ===`);
  log(`Processed:          ${summary.processed}`);
  log(`QIDs resolved:      ${summary.resolved}`);
  log(`QIDs attached:      ${summary.attached}`);
  log(`Skipped (taken):    ${summary.skippedQidTaken}`);
  log(`Unresolved:         ${summary.unresolved}`);
  log(`Remaining after:    ${Math.max(0, candidatesRemaining - summary.attached)}`);
  log(`Freshness stamped:  ${summary.freshnessStamped}`);

  return summary;
}
