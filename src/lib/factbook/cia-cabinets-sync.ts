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
 * Design mirrors `officeholders-sync.ts`: keep it pure-ish — take a `db`
 * instance (defaulting to the shared client) and a progress log sink, expose a
 * `computeCabinetPlan()` (pure read, writes NOTHING) → `reportCabinetPlan()`
 * dry-run split, and (in the apply path, a later round) stamp
 * `sources.last_sync_at` via `markSourcesSynced("cia_world_leaders", …)` — the
 * one sanctioned path — only when rows were actually written.
 *
 * THREE code-fixes carried by this workstream (see the plan §2.5):
 *   (a) office dedup keys on `(bodyId, name)`, NOT `(bodyId, officeType)` —
 *       otherwise N cabinet ministers (all office_type='cabinet') collapse to
 *       one. Implemented here in `upsertCabinetOffice` (apply path).
 *   (b) `OFFICE_RANK` in `queries.ts` used `judicial` but the stored type is
 *       `judicial_leader` — fixed in that file alongside this build.
 *   (c) provenance is mandatory — the apply path writes a `statements` row per
 *       term and calls `markSourcesSynced`. (The legacy hardcoded US/UK
 *       cabinets in `scripts/enrich-hierarchy.ts` wrote neither.)
 *
 * P4 APPLY (2026-07-01): the real write path is now wired below
 * (`syncCiaCabinets`). It reuses the exact `computeCabinetPlan` the dry run
 * reported on, then persists offices / persons / terms / statements and stamps
 * `markSourcesSynced`. Scope decision (owner-approved after a clean dry run):
 * ingest cabinet + central-bank + deputy + other; DROP the `diplomatic`
 * category (Ambassador-to-US / UN-rep). The `united-states` page is skipped
 * (404 — foreign governments only) and sub-national HK/Macau blocks are cut at
 * the section boundary by `parseCountryHtml`.
 */
import dns from "node:dns";

import { and, eq, ilike, inArray, isNull, sql } from "drizzle-orm";

import { db as sharedDb } from "@/lib/db";
import {
  jurisdictions,
  governmentBodies,
  offices,
  persons,
  terms,
  statements,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";

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
 * Classify a CIA position title into a category. Order matters: head first
 * (skip), then the specific non-cabinet buckets (central bank, diplomatic),
 * then deputy, then the broad cabinet catch, then "other".
 */
export function classifyPosition(title: string): PositionCategory {
  const t = title.trim();
  // Central bank FIRST — a "Pres., Bundesbank" / "Governor, Bank of X" must not
  // be mistaken for a country president or a minister.
  if (CENTRAL_BANK_RE.test(t)) return "central_bank";
  if (HEAD_TITLE_RE.test(t)) return "head";
  if (DIPLOMATIC_RE.test(t)) return "diplomatic";
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
    .replace(/&#8217;/g, "’")
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
 * wrong. Those appear after the main list; we cut the segment at the
 * "Explore Foreign Governments" sentinel, which is before them.
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

  // Sub-national blocks (e.g. China → Hong Kong / Macau) appear after the main
  // sovereign list, each introduced by an <h3 class="leaders-section">Region…</h3>.
  // v1 models sovereign jurisdictions only, so cut the segment at the FIRST such
  // sub-national header — attaching HK/Macau officials to "China" would be wrong.
  const subNational = seg.search(/<h3[^>]*class="leaders-section"/i);
  if (subNational >= 0) seg = seg.slice(0, subNational);

  const lu = seg.match(/Last Updated<\/b>\s*:?\s*<span>([^<]*)<\/span>/i);
  if (lu) result.lastUpdated = stripTags(lu[1]) || null;

  // Each position is a <div class="leader-info"><h4>title</h4><p>name</p></div>.
  const blockRe =
    /<div class="leader-info">\s*<h4[^>]*>([\s\S]*?)<\/h4>\s*(?:<p[^>]*>([\s\S]*?)<\/p>)?\s*<\/div>/gi;
  let m: RegExpExecArray | null;
  let order = 0;
  while ((m = blockRe.exec(seg)) !== null) {
    const title = stripTags(m[1]);
    const rawNameStr = m[2] != null ? stripTags(m[2]) : "";
    if (!title) continue;
    const rawName = rawNameStr.length > 0 ? rawNameStr : null;
    result.positions.push({
      title,
      rawName,
      order: order++,
      category: classifyPosition(title),
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
): Promise<{ ok: boolean; status: number; html: string }> {
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
 * aborts the ~194-country crawl. A non-2xx HTTP response (e.g. a 404) is NOT
 * retried — it's returned as `{ ok:false }` for the caller to treat as an
 * expected skip. Only genuine network/timeout errors are retried; a persistent
 * one after all attempts is re-thrown for the caller to record as a skip.
 *
 * The backoff waits are ADDITIONAL to the inter-country crawl-delay applied by
 * the loop — retries stay polite.
 */
async function fetchCountryResilient(
  slug: string,
  log: (line: string) => void,
  maxAttempts = 3,
): Promise<{ ok: boolean; status: number; html: string }> {
  // Exponential-ish backoff between retries (ms): 3s, 8s, 20s.
  const BACKOFFS_MS = [3_000, 8_000, 20_000];
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchCountry(slug);
    } catch (err) {
      lastErr = err;
      if (!isRetryableNetworkError(err) || attempt === maxAttempts) break;
      const wait = BACKOFFS_MS[Math.min(attempt - 1, BACKOFFS_MS.length - 1)];
      const reason = (err as Error)?.message ?? String(err);
      log(
        `  ↻ ${slug}: network error (${reason}); retry ${attempt}/${maxAttempts - 1} in ${Math.round(wait / 1000)}s`,
      );
      await new Promise((r) => setTimeout(r, wait));
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

// ─── Person identity resolution (owner decision 1) ───────────────────────────

export type PersonPath = "existing" | "qid" | "new";

export interface PersonResolution {
  path: PersonPath;
  /** Existing person id when path='existing'. */
  personId: string | null;
  /** Resolved Wikidata QID when path='qid'. */
  qid: string | null;
  /** Normalized display name. */
  name: string;
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

/**
 * Resolve a CIA-listed person to an existing row or a proposed new (ID-less)
 * person — per owner decision 1. The crawl/apply path does NO Wikidata call:
 *
 *   1. Exact (case-insensitive) name match to an existing `persons` row → reuse.
 *   2. else propose a new ID-less person (`wikidata_qid = null`).
 *
 * QID attachment is a separate, deferred concern — see `backfillCabinetQids()`.
 * This keeps the per-country cost to the 10s CIA crawl-delay + local DB writes.
 *
 * READ-ONLY: this only READS `persons`. It never writes and never hits the
 * network.
 */
export async function resolvePerson(
  db: CabinetSyncDb,
  rawName: string,
): Promise<PersonResolution> {
  const name = normalizeCiaName(rawName);

  // 1. Exact name match (case-insensitive).
  const exact = await db
    .select({ id: persons.id, qid: persons.wikidataQid })
    .from(persons)
    .where(ilike(persons.name, name))
    .limit(1);
  if (exact.length > 0) {
    return { path: "existing", personId: exact[0].id, qid: exact[0].qid, name };
  }

  // 2. Propose a new ID-less person. QID attaches later via the backfill.
  return { path: "new", personId: null, qid: null, name };
}

// ─── Dry-run plan ────────────────────────────────────────────────────────────

export interface PlannedPosition {
  title: string;
  rawName: string | null;
  normalizedName: string | null;
  order: number;
  category: PositionCategory;
  officeType: string;
  /** null when the post is unnamed/vacant (office created, no term). */
  personPath: PersonPath | null;
  qid: string | null;
  /**
   * Existing person id when `personPath === 'existing'`. Carried on the plan so
   * the apply path reuses the resolution instead of re-querying Wikidata (the
   * jurisdiction/person resolution already ran once in `computeCabinetPlan`).
   */
  personId: string | null;
}

export interface PlannedCountry {
  slug: string;
  countryName: string | null;
  jurisdictionId: string | null;
  jurisdictionName: string | null;
  lastUpdated: string | null;
  fetchStatus: number;
  parseFailed: boolean;
  jurisdictionMatched: boolean;
  positions: PlannedPosition[];
}

/** A country skipped because its fetch failed after all retries (or an
 * unexpected parse-time throw). Distinct from a clean 404, which is not a
 * failure — see `computeCabinetPlan`. Surfaced so a targeted re-run can pick up
 * the stragglers without redoing the whole crawl. */
export interface FailedCountry {
  slug: string;
  reason: string;
}

export interface CabinetPlan {
  countries: PlannedCountry[];
  /** Countries whose fetch/parse errored after retries and were SKIPPED (the
   * crawl continued). Empty on a fully-clean run. */
  failed: FailedCountry[];
  stats: {
    countriesFetched: number;
    countriesParsed: number;
    countriesUnmatched: number;
    countriesFetchFailed: number;
    /** Countries SKIPPED after exhausting retries on a network/timeout error
     * (the crawl continued). Counted separately from an expected 404. */
    countriesSkipped: number;
    /** Positions the CIA lists, total across the sample. */
    positionsTotal: number;
    /** Head rows skipped (owned by the Wikidata spine). */
    headsSkipped: number;
    /** Positions that would become offices (everything except heads). */
    positionsIngested: number;
    /** Positions with a named holder → a term. */
    named: number;
    /** Positions with no name → office created, no term (vacant). */
    vacant: number;
    byCategory: Record<PositionCategory, number>;
    // Person identity split (over NAMED, ingested positions).
    personExisting: number;
    personQid: number;
    personNew: number;
    /** Distinct proposed NEW persons (QID-less) across the sample. */
    distinctNewPersons: number;
    /** Distinct proposed QID-attached persons across the sample. */
    distinctQidPersons: number;
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
 * Fetch the sample, parse, resolve jurisdictions + persons, and assemble the
 * proposed change set. Pure READ — hits cia.gov (HTML) and reads
 * `jurisdictions` / `persons`. Does NOT hit Wikidata: person identity is an
 * exact-name match → else new ID-less. Writes NOTHING.
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
      personExisting: 0,
      personQid: 0,
      personNew: 0,
      distinctNewPersons: 0,
      distinctQidPersons: 0,
    },
  };

  // Dedup person proposals across the whole sample (a human held once, many
  // offices). Keyed by lowercased normalized name.
  const seenNewNames = new Set<string>();

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    if (i > 0) await new Promise((r) => setTimeout(r, crawlDelay));

    log(`Fetching ${slug} …`);

    // ── ENTIRE per-country body is guarded ──────────────────────────────────
    // ONE try/catch wraps the whole iteration: the CIA fetch, the
    // `findJurisdictionBySlug` Neon read, parse, and every per-position
    // `resolvePerson` Neon read. On ANY thrown error (network, Neon
    // ConnectTimeout, parse edge, anything), we log `⚠ skipped <slug>`, push to
    // `failed[]`, and `continue`. NOTHING a single country does may abort the
    // ~194-country crawl. (The prior bug: `findJurisdictionBySlug` sat OUTSIDE
    // the guards, so a Neon timeout there killed the whole run at ~country 25.)
    // Every per-country Neon call is additionally wrapped in `withDbRetry` so a
    // transient serverless-HTTP blip retries before it ever reaches this catch.
    // Counted once per iteration whether the body succeeds or the catch fires,
    // so a fetch-then-DB-timeout skip isn't double-counted in `countriesFetched`.
    let countedFetched = false;
    try {
      // Resilient fetch: a network/timeout error retries (backoff) internally.
      // A clean 404 is an expected skip (handled below via `ok === false`), NOT
      // a failure; a persistent network error re-throws into the catch below.
      const { ok, status, html } = await fetchCountryResilient(slug, log);
      plan.stats.countriesFetched++;
      countedFetched = true;

      const juris = await withDbRetry(
        () => findJurisdictionBySlug(db, slug),
        { log, label: `findJurisdiction(${slug})` },
      );
      const country: PlannedCountry = {
        slug,
        countryName: null,
        jurisdictionId: juris?.id ?? null,
        jurisdictionName: juris?.name ?? null,
        lastUpdated: null,
        fetchStatus: status,
        parseFailed: false,
        jurisdictionMatched: !!juris,
        positions: [],
      };
      if (!juris) plan.stats.countriesUnmatched++;

      if (!ok) {
        country.parseFailed = true;
        plan.stats.countriesFetchFailed++;
        // A 404 is expected (foreign-governments-only directory; e.g.
        // united-states) — an ordinary skip, not a failure. Other non-2xx codes
        // (e.g. 5xx) also land here after the retry loop couldn't get a 2xx.
        log(`! ${slug}: fetch failed (HTTP ${status})`);
        plan.countries.push(country);
        continue;
      }

      const parsed = parseCountryHtml(slug, html);
      country.countryName = parsed.countryName;
      country.lastUpdated = parsed.lastUpdated;
      country.parseFailed = parsed.parseFailed;
      if (parsed.parseFailed) {
        log(`! ${slug}: parse failed (no leaders section)`);
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

        const officeType = officeTypeForCategory(pos.category);
        const planned: PlannedPosition = {
          title: pos.title,
          rawName: pos.rawName,
          normalizedName: pos.rawName ? normalizeCiaName(pos.rawName) : null,
          order: pos.order,
          category: pos.category,
          officeType,
          personPath: null,
          qid: null,
          personId: null,
        };

        if (!pos.rawName) {
          // Unnamed / vacant post: office created, no term. Never invent a holder.
          plan.stats.vacant++;
          country.positions.push(planned);
          continue;
        }
        plan.stats.named++;

        // Fast, network-free identity resolution: exact-name match → else new
        // ID-less person. NO Wikidata call here — QID attachment is deferred to
        // `backfillCabinetQids()`. The Neon read is retry-wrapped.
        const resolution = await withDbRetry(
          () => resolvePerson(db, pos.rawName as string),
          { log, label: `resolvePerson(${slug})` },
        );
        planned.personPath = resolution.path;
        planned.qid = resolution.qid;
        planned.personId = resolution.personId;

        if (resolution.path === "existing") plan.stats.personExisting++;
        else {
          plan.stats.personNew++;
          const key = resolution.name.toLowerCase();
          if (!seenNewNames.has(key)) {
            seenNewNames.add(key);
            plan.stats.distinctNewPersons++;
          }
        }

        country.positions.push(planned);
      }

      log(
        `  ✓ ${slug}: ${parsed.positions.length} positions (${country.positions.length} to ingest)`,
      );
      plan.countries.push(country);
    } catch (err) {
      // ANY failure in the per-country body (fetch after retries, a Neon
      // timeout in findJurisdictionBySlug / resolvePerson, a parse throw) skips
      // THIS country and records it — the crawl runs to completion.
      if (!countedFetched) plan.stats.countriesFetched++;
      plan.stats.countriesSkipped++;
      const reason = (err as Error)?.message ?? String(err);
      plan.failed.push({ slug, reason });
      log(`⚠ skipped ${slug}: ${reason}`);
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
  log(`  → skipped (network, retried): ${s.countriesSkipped}`);
  log(`  → no jurisdiction match:      ${s.countriesUnmatched}`);
  if (plan.failed.length > 0) {
    log(`\n  SKIPPED after retries (targeted re-run needed):`);
    for (const f of plan.failed) log(`    ⚠ ${f.slug}: ${f.reason}`);
  }

  log("\nVOLUME (across the parsed sample)");
  log(`  Positions the CIA lists:      ${s.positionsTotal}`);
  log(`  → head rows skipped (spine):  ${s.headsSkipped}`);
  log(`  → positions to ingest:        ${s.positionsIngested}`);
  log(`     · named (→ term):          ${s.named}`);
  log(`     · unnamed (vacant office): ${s.vacant}`);
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
    `  Offices to create:  ~${Math.round(avgIngestPerCountry * FULL_DIRECTORY_COUNT).toLocaleString("en-US")}`,
  );
  for (const cat of [
    "cabinet",
    "central_bank",
    "diplomatic",
    "deputy",
    "other",
  ] as PositionCategory[]) {
    const avg = s.byCategory[cat] / parsed;
    log(
      `    · ${cat.padEnd(13)} ~${Math.round(avg * FULL_DIRECTORY_COUNT).toLocaleString("en-US")}`,
    );
  }

  log("\nPERSON IDENTITY SPLIT (over named, ingested positions)");
  log("  (crawl is network-free: exact-match → else new ID-less;");
  log("   QID attachment is the deferred `--backfill-qids` pass)");
  const namedTotal = s.named || 1;
  log(
    `  Exact-match existing person:  ${s.personExisting} (${pct(s.personExisting, namedTotal)}%)`,
  );
  log(
    `  Create ID-less (no QID yet):  ${s.personNew} (${pct(s.personNew, namedTotal)}%)  → ${s.distinctNewPersons} distinct new ID-less persons`,
  );
  log("");
  log(
    `  Person-QID invariant impact: today 351/351 persons carry a QID (100%).`,
  );
  const projNew = Math.round(
    (s.distinctNewPersons / parsed) * FULL_DIRECTORY_COUNT,
  );
  log(
    `  Extrapolated full run adds ~${projNew.toLocaleString("en-US")} ID-less persons`,
  );
  log(
    `  across ~195 countries; the deferred backfill later attaches QIDs where`,
  );
  log(`  confident (never fuzzy-merged).`);
  if (projNew > 0) {
    const newCoverage = pct(351, 351 + projNew);
    log(
      `  → QID coverage drops to ~${newCoverage}% until the backfill runs.`,
    );
  }

  // Per-country samples (first 3 matched countries with positions).
  log("\nSAMPLE — parsed positions → proposed office_type + person path");
  const sampleCountries = plan.countries
    .filter((c) => c.jurisdictionMatched && c.positions.length > 0)
    .slice(0, 3);
  for (const c of sampleCountries) {
    log(
      `\n  ${c.jurisdictionName ?? c.slug}  (Last Updated: ${c.lastUpdated ?? "?"}, ${c.positions.length} positions to ingest)`,
    );
    for (const p of c.positions.slice(0, 16)) {
      const holder = p.normalizedName ?? "(vacant — no holder)";
      const path =
        p.personPath === null
          ? "vacant"
          : p.personPath === "qid"
            ? `QID ${p.qid}`
            : p.personPath;
      log(
        `    [${p.officeType}] "${p.title}" → ${holder}  ·  ${path}`,
      );
    }
    if (c.positions.length > 16) {
      log(`    … and ${c.positions.length - 16} more`);
    }
  }

  log("\nAPPLY-PATH WRITE SHAPE (NOT run this round)");
  log(
    "  · reuse existing \"Executive of <country>\" body (cabinet/executive)",
  );
  log(
    "  · offices dedup on (bodyId, name) [fix a]; office_type = category tag;",
  );
  log("    display_order = CIA list index (additive column, staged not pushed)");
  log(
    "  · persons: existing id / new{qid:null}; terms current;",
  );
  log(
    `  · statements provenance per term (predicate 'cabinet_member', source '${CIA_WORLD_LEADERS_SOURCE_ID}')`,
  );
  log(`  · markSourcesSynced("${CIA_WORLD_LEADERS_SOURCE_ID}") on write`);
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
 * divergences (verified live 2026-07-01 via HEAD probes). Anything not here
 * uses the Civica slug unchanged.
 */
export const CIA_SLUG_OVERRIDES: Record<string, string> = {
  drc: "congo-democratic-republic-of-the",
  "congo-brazzaville": "congo-republic-of-the",
  "the-bahamas": "bahamas-the",
  "the-gambia": "gambia-the",
  "the-dominican": "dominican-republic",
  "c-te-d-ivoire": "cote-divoire",
  "north-korea": "korea-north",
  "south-korea": "korea-south",
};

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

// ─── Apply-path write helpers (mirror officeholders-sync, with fix a) ────────

/**
 * Reuse the country's existing `"Executive of <country>"` body
 * (`body_type='cabinet'`, `branch='executive'`) — 197 already exist. Create it
 * only if missing. Keyed on (jurisdictionId, branch='executive'), matching
 * `officeholders-sync.upsertBody`.
 */
async function upsertExecutiveBody(
  db: CabinetSyncDb,
  jurisdictionId: string,
  countryName: string,
): Promise<string> {
  const existing = await db
    .select({ id: governmentBodies.id })
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId} AND ${governmentBodies.branch} = ${"executive"}`,
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(governmentBodies)
    .values({
      jurisdictionId,
      name: `Executive of ${countryName}`,
      bodyType: "cabinet",
      branch: "executive",
      hierarchyLevel: 0,
    })
    .returning({ id: governmentBodies.id });
  return inserted[0].id;
}

/**
 * Cabinet-safe office upsert. FIX (a): dedup on `(bodyId, name)`, NOT
 * `(bodyId, officeType)` — the latter collapses N ministers (all
 * `office_type='cabinet'`) into one. Updates `office_type` + `display_order`
 * on an existing (bodyId, name) match so re-runs stay idempotent and keep the
 * CIA list order fresh.
 */
async function upsertCabinetOffice(
  db: CabinetSyncDb,
  bodyId: string,
  name: string,
  officeType: string,
  displayOrder: number,
): Promise<string> {
  const existing = await db
    .select({ id: offices.id })
    .from(offices)
    .where(sql`${offices.bodyId} = ${bodyId} AND ${offices.name} = ${name}`)
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(offices)
      .set({ officeType, displayOrder })
      .where(eq(offices.id, existing[0].id));
    return existing[0].id;
  }

  const inserted = await db
    .insert(offices)
    .values({
      bodyId,
      name,
      officeType,
      isElected: false,
      displayOrder,
    })
    .returning({ id: offices.id });
  return inserted[0].id;
}

/**
 * Resolve the person id to link a term to, per owner decision 1:
 *   - path 'existing' → the matched existing person id.
 *   - path 'qid'      → upsert-by-QID (dedup on wikidata_qid; a person with
 *                       that QID may already exist from a race, so re-check).
 *   - path 'new'      → create a QID-less person.
 * Never fuzzy-merges. Returns the person id.
 */
async function persistPerson(
  db: CabinetSyncDb,
  resolution: PersonResolution,
): Promise<string> {
  if (resolution.path === "existing" && resolution.personId) {
    return resolution.personId;
  }

  if (resolution.path === "qid" && resolution.qid) {
    const byQid = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.wikidataQid, resolution.qid))
      .limit(1);
    if (byQid.length > 0) return byQid[0].id;
    const inserted = await db
      .insert(persons)
      .values({ name: resolution.name, wikidataQid: resolution.qid })
      .returning({ id: persons.id });
    return inserted[0].id;
  }

  // path 'new' — create ID-less. Guard against a same-run duplicate by an
  // exact-name re-check (two offices can list the same unmatched person).
  const byName = await db
    .select({ id: persons.id })
    .from(persons)
    .where(ilike(persons.name, resolution.name))
    .limit(1);
  if (byName.length > 0) return byName[0].id;

  const inserted = await db
    .insert(persons)
    .values({ name: resolution.name, wikidataQid: null })
    .returning({ id: persons.id });
  return inserted[0].id;
}

/**
 * Idempotent term upsert — identical semantics to
 * `officeholders-sync.upsertTerm`: reuse an existing
 * (officeId, personId, startDate) row and flip every OTHER term on the office
 * to non-current, so re-running the sync never accumulates duplicate rows.
 */
async function upsertCabinetTerm(
  db: CabinetSyncDb,
  officeId: string,
  personId: string,
  startDate: string | null,
): Promise<void> {
  const existing = await db
    .select({ id: terms.id, isCurrent: terms.isCurrent })
    .from(terms)
    .where(
      sql`${terms.officeId} = ${officeId} AND ${terms.personId} = ${personId} AND ${terms.startDate} IS NOT DISTINCT FROM ${startDate}`,
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(terms)
      .set({ isCurrent: false })
      .where(
        sql`${terms.officeId} = ${officeId} AND ${terms.id} <> ${existing[0].id} AND ${terms.isCurrent} = true`,
      );
    if (!existing[0].isCurrent) {
      await db
        .update(terms)
        .set({ isCurrent: true })
        .where(eq(terms.id, existing[0].id));
    }
    return;
  }

  await db
    .update(terms)
    .set({ isCurrent: false })
    .where(sql`${terms.officeId} = ${officeId} AND ${terms.isCurrent} = true`);

  await db.insert(terms).values({
    officeId,
    personId,
    startDate,
    isCurrent: true,
  });
}

/**
 * Provenance row for a cabinet term. Mirrors
 * `officeholders-sync.upsertStatement` (subject_table='terms', subject_id is
 * the person id — the established convention there), but sourced to
 * `cia_world_leaders` (public domain) with the per-country page URL. Idempotent
 * on (subject_table, subject_id, predicate).
 */
async function upsertCabinetStatement(
  db: CabinetSyncDb,
  personId: string,
  predicate: string,
  objectValue: string,
  sourceUrl: string,
): Promise<void> {
  const existing = await db
    .select({ id: statements.id })
    .from(statements)
    .where(
      sql`${statements.subjectTable} = ${"terms"} AND ${statements.subjectId} = ${personId} AND ${statements.predicate} = ${predicate}`,
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(statements)
      .set({
        objectValue,
        sourceId: CIA_WORLD_LEADERS_SOURCE_ID,
        sourceUrl,
        sourceLicense: "public_domain",
        retrievedAt: new Date(),
      })
      .where(eq(statements.id, existing[0].id));
    return;
  }

  await db.insert(statements).values({
    subjectTable: "terms",
    subjectId: personId,
    predicate,
    objectValue,
    sourceId: CIA_WORLD_LEADERS_SOURCE_ID,
    sourceUrl,
    sourceLicense: "public_domain",
    retrievedAt: new Date(),
  });
}

// ─── Apply orchestrator ──────────────────────────────────────────────────────

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

/** Parse a CIA "Last Updated: M/D/YYYY" stamp to an ISO yyyy-mm-dd, or null. */
function parseLastUpdated(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  const iso = `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : iso;
}

export interface CiaCabinetSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  countriesCrawled: number;
  countriesApplied: number;
  countriesFetchFailed: number;
  /** Countries skipped after exhausting network retries (crawl continued). */
  countriesSkipped: number;
  /** The skipped slugs + reasons, so a targeted re-run can pick up stragglers. */
  skipped: FailedCountry[];
  countriesUnmatched: number;
  officesWritten: number;
  personsExisting: number;
  personsQidCreated: number;
  personsIdlessCreated: number;
  termsWritten: number;
  vacantOffices: number;
  diplomaticSkipped: number;
  statementsWritten: number;
  totalRowsWritten: number;
  freshnessStamped: boolean;
  dryRun: boolean;
}

/**
 * The FULL CIA World Leaders cabinet apply. Reuses `computeCabinetPlan` (the
 * exact read the dry run reported on), then persists offices / persons / terms
 * / statements and stamps `markSourcesSynced("cia_world_leaders")`.
 *
 * `slugs` defaults to the full `buildCiaSlugList()` crawl (~194 candidates,
 * 404-tolerant). The cron route and the CLI both call this; the CLI can pass a
 * sample. Cost is now just the 10s crawl-delay × ~194 pages + local DB writes
 * (no per-person Wikidata call) ≈ 35–45 min. QID attachment is the separate,
 * deferred `backfillCabinetQids()` pass.
 */
export async function syncCiaCabinets(
  options: CabinetSyncOptions = {},
): Promise<CiaCabinetSyncSummary> {
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const slugs = options.slugs ?? (await buildCiaSlugList(db));
  log(`=== CIA World Leaders Cabinet Sync (APPLY) ===`);
  log(`Crawling ${slugs.length} CIA candidate pages …`);

  const plan = options.plan ?? await computeCabinetPlan({
    db,
    slugs,
    crawlDelayMs: options.crawlDelayMs,
    onProgress: log,
  });

  const summary: CiaCabinetSyncSummary = {
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    countriesCrawled: plan.stats.countriesFetched,
    countriesApplied: 0,
    countriesFetchFailed: plan.stats.countriesFetchFailed,
    countriesSkipped: plan.stats.countriesSkipped,
    skipped: plan.failed,
    countriesUnmatched: plan.stats.countriesUnmatched,
    officesWritten: 0,
    personsExisting: 0,
    personsQidCreated: 0,
    personsIdlessCreated: 0,
    termsWritten: 0,
    vacantOffices: 0,
    diplomaticSkipped: 0,
    statementsWritten: 0,
    totalRowsWritten: 0,
    freshnessStamped: false,
    dryRun: options.dryRun ?? false,
  };

  if (options.dryRun) {
    for (const country of plan.countries) {
      if (!country.jurisdictionMatched || country.parseFailed) continue;
      let appliedAny = false;
      for (const pos of country.positions) {
        if (pos.category === "diplomatic") {
          summary.diplomaticSkipped++;
          continue;
        }
        if (!INGEST_CATEGORIES.has(pos.category)) continue;
        summary.officesWritten++;
        appliedAny = true;
        if (!pos.rawName || !pos.personPath) {
          summary.vacantOffices++;
          continue;
        }
        summary.termsWritten++;
        summary.statementsWritten++;
        if (pos.personPath === "existing") summary.personsExisting++;
        else if (pos.personPath === "qid") summary.personsQidCreated++;
        else summary.personsIdlessCreated++;
      }
      if (appliedAny) summary.countriesApplied++;
    }
    summary.totalRowsWritten = summary.officesWritten + summary.termsWritten + summary.statementsWritten;
    const finishedAtMs = Date.now();
    summary.finishedAt = new Date(finishedAtMs).toISOString();
    summary.durationMs = finishedAtMs - startedAtMs;
    return summary;
  }

  log(`=== Applying — persisting offices / persons / terms / statements ===`);
  for (const country of plan.countries) {
    if (!country.jurisdictionMatched || !country.jurisdictionId) continue;
    if (country.parseFailed || country.positions.length === 0) continue;

    // Guard the ENTIRE per-country write body: a Neon timeout on any office /
    // person / term / statement write skips THIS country (recorded in
    // `skipped[]`) instead of aborting the apply after ~25 countries. Each Neon
    // call is additionally `withDbRetry`-wrapped so a transient blip retries
    // first. Writes are idempotent, so a partially-written country is safely
    // completed by a re-run.
    try {
      const sourceUrl = `${CIA_BASE}/${country.slug}/`;
      const startDate = parseLastUpdated(country.lastUpdated);
      const bodyId = await withDbRetry(
        () =>
          upsertExecutiveBody(
            db,
            country.jurisdictionId as string,
            country.jurisdictionName ?? country.countryName ?? country.slug,
          ),
        { log, label: `upsertBody(${country.slug})` },
      );

      let appliedAny = false;
      for (const pos of country.positions) {
        // Owner scope: drop diplomatic entirely.
        if (pos.category === "diplomatic") {
          summary.diplomaticSkipped++;
          continue;
        }
        if (!INGEST_CATEGORIES.has(pos.category)) continue;

        const officeId = await withDbRetry(
          () =>
            upsertCabinetOffice(db, bodyId, pos.title, pos.officeType, pos.order),
          { log, label: `upsertOffice(${country.slug})` },
        );
        summary.officesWritten++;
        appliedAny = true;

        // Unnamed / vacant post: office created, NO term. Never invent a holder.
        if (!pos.rawName || !pos.normalizedName || !pos.personPath) {
          summary.vacantOffices++;
          continue;
        }

        // Reuse the plan's already-computed person resolution (jurisdiction +
        // person resolution ran once in computeCabinetPlan) — no re-query.
        const personId = await withDbRetry(
          () =>
            persistPerson(db, {
              path: pos.personPath as PersonPath,
              personId: pos.personId,
              qid: pos.qid,
              name: pos.normalizedName as string,
            }),
          { log, label: `persistPerson(${country.slug})` },
        );
        if (pos.personPath === "existing") summary.personsExisting++;
        else if (pos.personPath === "qid") summary.personsQidCreated++;
        else summary.personsIdlessCreated++;

        await withDbRetry(
          () => upsertCabinetTerm(db, officeId, personId, startDate),
          { log, label: `upsertTerm(${country.slug})` },
        );
        summary.termsWritten++;

        await withDbRetry(
          () =>
            upsertCabinetStatement(
              db,
              personId,
              "cabinet_member",
              pos.title,
              sourceUrl,
            ),
          { log, label: `upsertStatement(${country.slug})` },
        );
        summary.statementsWritten++;
      }

      if (appliedAny) {
        summary.countriesApplied++;
        log(`  ✓ ${country.jurisdictionName ?? country.slug}`);
      }
    } catch (err) {
      // A Neon failure while writing this country skips it and records the
      // straggler — the apply loop continues to the last country.
      summary.countriesSkipped++;
      const reason = (err as Error)?.message ?? String(err);
      summary.skipped.push({
        slug: country.slug,
        reason: `apply write error: ${reason}`,
      });
      log(`⚠ skipped ${country.slug}: apply write error: ${reason}`);
      continue;
    }
  }

  summary.totalRowsWritten =
    summary.officesWritten + summary.termsWritten + summary.statementsWritten;

  const stamped = await (options.markSynced ?? markSourcesSynced)(CIA_WORLD_LEADERS_SOURCE_ID, {
    rowsWritten: summary.skipped.length === 0 ? summary.totalRowsWritten : 0,
    executor: db,
  });
  summary.freshnessStamped = stamped.length > 0;

  const finishedAtMs = Date.now();
  summary.finishedAt = new Date(finishedAtMs).toISOString();
  summary.durationMs = finishedAtMs - startedAtMs;

  log(`=== CIA Cabinet Sync Complete ===`);
  log(`Countries crawled:        ${summary.countriesCrawled}`);
  log(`Countries applied:        ${summary.countriesApplied}`);
  log(`Countries skipped (net):  ${summary.countriesSkipped}`);
  log(`HTTP non-2xx (e.g. 404):  ${summary.countriesFetchFailed}`);
  log(`Offices written:          ${summary.officesWritten}`);
  log(`  · vacant (no term):     ${summary.vacantOffices}`);
  log(`Terms written:            ${summary.termsWritten}`);
  log(`Persons — existing:       ${summary.personsExisting}`);
  log(`Persons — QID-created:    ${summary.personsQidCreated}`);
  log(`Persons — ID-less:        ${summary.personsIdlessCreated}`);
  log(`Diplomatic dropped:       ${summary.diplomaticSkipped}`);
  log(`Statements written:       ${summary.statementsWritten}`);
  log(`Total rows written:       ${summary.totalRowsWritten}`);
  log(`Freshness stamped:        ${summary.freshnessStamped}`);
  if (summary.skipped.length > 0) {
    log(
      `\n⚠ ${summary.skipped.length} country(ies) skipped after retries — the crawl still completed:`,
    );
    for (const f of summary.skipped) log(`    ${f.slug}: ${f.reason}`);
    log(
      `  Re-run to pick up the stragglers (writes are idempotent, so a full`,
    );
    log(
      `  re-apply is safe): [${summary.skipped.map((f) => f.slug).join(", ")}]`,
    );
  } else {
    log(`\n✓ All crawled countries completed (no network skips).`);
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
 * writes: `subject_table='terms'`, `subject_id = <person id>`). Ordered by
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
    .innerJoin(
      statements,
      and(
        eq(statements.subjectTable, "terms"),
        eq(statements.subjectId, persons.id),
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
    .innerJoin(
      statements,
      and(
        eq(statements.subjectTable, "terms"),
        eq(statements.subjectId, persons.id),
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

    await db
      .update(persons)
      .set({ wikidataQid: qid })
      .where(inArray(persons.id, [person.id]));
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
