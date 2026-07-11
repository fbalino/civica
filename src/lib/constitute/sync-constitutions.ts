/**
 * Constitute Project constitution sync — orchestration (library form).
 *
 * Ingests each in-force national constitution from the Constitute Project
 * (constituteproject.org) into Civica's `constitutions` row (full HTML +
 * parsed `structured_articles`) and the `constitution_topic_excerpts`
 * cross-reference index that powers the Constitution Explorer's topic pane.
 *
 * Endpoints (verified live 2026-07-01):
 *   GET /service/constitutions?lang=en   → 238 rows; filter in_force===true → 186.
 *   GET /service/locations?lang=en        → country_id → ISO numeric map.
 *   GET /service/html?cons_id=<id>&lang=en → { html, title } full constitution.
 *   (Topic taxonomy is cached separately → topic-taxonomy.generated.json.)
 *
 * Design mirrors `src/lib/factbook/cia-cabinets-sync.ts`: take a `db` instance
 * (defaulting to the shared client) + a progress sink, wrap every per-country
 * body in ONE try/catch (skip-and-continue), wrap every DB/network call in a
 * retry ladder (3s/8s/20s), and stamp `sources.last_sync_at` ONLY via
 * `markSourcesSynced("constitute_project", …)` when rows were actually written.
 *
 * License posture: Constitute is CC BY-NC 3.0 (non-commercial only). Civica's
 * use is display-only; the ingested text is never exposed via a paid tier or
 * bulk redistribution. Attribution: Elkins, Ginsburg & Melton, "Constitute:
 * The World's Constitutions to Read, Search, and Compare."
 */
import { parse, type HTMLElement, type Node } from "node-html-parser";

import { db as sharedDb } from "@/lib/db";
import {
  jurisdictions,
  constitutions,
  constitutionTopicExcerpts,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import { eq } from "drizzle-orm";

import { getTopicLabel } from "./topics";

// ─── Config ──────────────────────────────────────────────────────────────────

const CONSTITUTE_BASE = "https://www.constituteproject.org/service";

/** The seeded `sources` row id (seed-sources.ts). Freshness + provenance anchor. */
export const CONSTITUTE_SOURCE_ID = "constitute_project";

/** A descriptive, contactable UA — good-citizen crawling. */
const CONSTITUTE_USER_AGENT =
  "CivicaAtlas/1.0 (https://civicaatlas.org; admin@civicaatlas.org)";

/**
 * Politeness delay between per-country HTML fetches. Constitute publishes no
 * documented rate limit; ~400ms keeps us well under a load that would burden
 * a public academic service.
 */
const POLITENESS_DELAY_MS = 400;

/** Overall per-request timeout. India (~1.5MB) is the largest and rides this fine. */
const REQUEST_TIMEOUT_MS = 60_000;

// ─── Country matching ────────────────────────────────────────────────────────
//
// Constitute rows carry `country_id` (e.g. `United_States_of_America`).
// `/locations` maps that to an ISO 3166-1 NUMERIC code; we convert numeric →
// alpha-3 → `jurisdictions.iso3` (case-insensitive). Two straggler paths:
//   · legacy numeric codes Constitute still uses (Sudan 736 → SDN).
//   · ISO-code-less entries matched to a Civica slug directly (Kosovo, Palestine).
// Everything unmatched is REPORTED, never guessed.

/**
 * Constitute legacy/non-standard NUMERIC isocode → ISO 3166-1 alpha-3.
 * Constitute still uses pre-2011 Sudan (736); the current standard is 729.
 */
const NUMERIC_ISO_ALIAS: Record<string, string> = {
  "736": "SDN", // Sudan — Constitute retains the pre-2011 numeric code.
};

/**
 * Constitute `country_id` → Civica jurisdiction slug, for entries with no
 * ISO numeric code in `/locations` (Kosovo has no assigned ISO numeric; the
 * Constitute "Palestine" row predates the 275/PSE assignment used here).
 */
const COUNTRY_ID_SLUG_ALIAS: Record<string, string> = {
  Kosovo: "kosovo",
  Palestine: "palestine",
};

// ─── Types (Constitute API + parsed output) ──────────────────────────────────

interface ConstituteConstitutionRow {
  id: string; // cons_id, e.g. "United_States_of_America_1992"
  country_id: string; // e.g. "United_States_of_America"
  country: string; // display name
  in_force: boolean;
  year_enacted: string | null;
  year_updated: string | null;
}

interface ConstituteLocationsResponse {
  id: string;
  name: string;
  countries: Array<{ id: string; name: string; isocode: string }>;
}

interface ConstituteHtmlResponse {
  html: string;
  title: string;
}

/** One parsed section entry (the shape stored in `structured_articles`). */
export interface StructuredArticle {
  /** Constitute section id, e.g. `section/8`. */
  sectionId: string;
  /** Nearest ancestor article/title heading, e.g. "Article I" (null if none). */
  headingLabel: string | null;
  /** Constitute ontology leaf keys from `data-topics` (may be empty). */
  topics: string[];
  /** The section's OWN inner HTML (nested sub-sections excluded). */
  html: string;
}

/**
 * A parsed section plus the excerpt payload for `constitution_topic_excerpts`.
 * `excerptHtml` deliberately differs from `html`:
 *   · `html` (stored in `structured_articles`) is the section's OWN inner HTML
 *     with nested sub-sections EXCLUDED — right for the reading column, where
 *     children render as their own entries and duplication is a bug.
 *   · `excerptHtml` is the section's FULL inner HTML with nested sub-sections
 *     INCLUDED (capped at EXCERPT_MAX_CHARS) — right for the cross-reference
 *     pane, which must show the PASSAGE. Constitute often hangs `data-topics`
 *     on a section whose own children are just a heading (e.g. France `amend`
 *     → "<h3>ARTICLE 89</h3>") with the clause text nested in child section
 *     divs; excluding children there stores a hollow heading-only excerpt.
 * `excerptHtml` is null when even the full subtree's text is too short to be
 * a meaningful excerpt (< EXCERPT_MIN_TEXT_CHARS) — such rows are skipped.
 */
export interface ParsedSection extends StructuredArticle {
  excerptHtml: string | null;
}

// ─── HTML parsing ────────────────────────────────────────────────────────────

/**
 * Cap for a stored excerpt: a topic tagged on a whole chapter must not store
 * the chapter. Longer subtrees are truncated at a clean tag boundary and an
 * ellipsis marker is appended.
 */
const EXCERPT_MAX_CHARS = 8_000;

/** Minimum meaningful TEXT content for an excerpt row to be worth storing. */
const EXCERPT_MIN_TEXT_CHARS = 20;

/** Marker appended to a truncated excerpt (UI can style `.excerpt-truncated`). */
const EXCERPT_TRUNCATION_MARKER = '<p class="excerpt-truncated">…</p>';

/**
 * The section's OWN direct-child heading (h1–h6 that is an immediate child, not
 * one belonging to a nested `div.section`). Returns null when the section opens
 * with body text rather than a heading.
 */
function ownHeading(sec: HTMLElement): string | null {
  for (const child of sec.childNodes) {
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = (el.rawTagName ?? "").toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const text = el.text.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
  }
  return null;
}

/**
 * Nearest ancestor heading: walk up the section-nesting chain to the first
 * `div.section` (this one or an ancestor) that carries an own heading. This
 * gives a leaf clause its article/title context (e.g. a bare "Section 1" body
 * under "Article I" resolves to "Article I").
 */
function nearestHeading(sec: HTMLElement): string | null {
  let node: HTMLElement | null = sec;
  while (node) {
    if (
      node.nodeType === 1 &&
      node.classList &&
      node.classList.contains("section")
    ) {
      const h = ownHeading(node);
      if (h) return h;
    }
    node = node.parentNode as HTMLElement | null;
  }
  return null;
}

/**
 * Is this node a `div.section` — i.e. a node that `parseConstitutionHtml`'s
 * `querySelectorAll("div.section")` will emit as its OWN entry? Deliberately
 * the same predicate (tag `div` + class `section`) so the set of subtrees we
 * exclude from a parent's own content is exactly the set that renders
 * elsewhere — nothing is dropped from one place without appearing in another.
 */
function isSectionDiv(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const el = node as HTMLElement;
  return (
    (el.rawTagName ?? "").toLowerCase() === "div" &&
    !!el.classList &&
    el.classList.contains("section")
  );
}

/**
 * Serialize a node's subtree, omitting every descendant `div.section` subtree
 * at ANY depth — not just direct children. Constitute sometimes nests a
 * section inside an intermediate wrapper (e.g. `<ol><li><div class="section">`
 * in the U.S. ratification block); a direct-child-only skip would leave that
 * nested section's full markup inside the parent's stored `html` while the
 * nested section ALSO renders as its own entry — the same clause twice in the
 * reading column.
 *
 * NON-DESTRUCTIVE by construction: this walks the live parse tree without
 * mutating it. `excerptHtmlForSection()` serializes the FULL subtree (nested
 * sections included, by design) and `nearestHeading()` walks live ancestors,
 * so the shared tree must stay intact — no `remove()`, no detaching.
 *
 * Fast path: a subtree containing no `div.section` serializes verbatim via the
 * library (this also covers void tags like `<br>`, which have no children);
 * only wrapper chains that actually contain nested sections are rebuilt
 * tag-by-tag around the surviving children.
 */
function serializeWithoutNestedSections(node: Node): string {
  if (node.nodeType !== 1) return node.toString();
  const el = node as HTMLElement;
  if (isSectionDiv(el)) return "";
  if (!el.querySelector("div.section")) return el.toString();
  const tag = el.rawTagName || "div";
  const attrs = el.rawAttrs ? ` ${el.rawAttrs}` : "";
  let inner = "";
  for (const child of el.childNodes) {
    inner += serializeWithoutNestedSections(child);
  }
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/**
 * Text counterpart of `serializeWithoutNestedSections`: the subtree's visible
 * text minus every descendant `div.section` subtree at any depth.
 */
function textWithoutNestedSections(node: Node): string {
  if (node.nodeType !== 1) return node.text;
  const el = node as HTMLElement;
  if (isSectionDiv(el)) return "";
  if (!el.querySelector("div.section")) return el.text;
  let out = "";
  for (const child of el.childNodes) {
    out += textWithoutNestedSections(child);
  }
  return out;
}

/**
 * The section's OWN inner HTML — its subtree MINUS every descendant
 * `div.section` subtree at any depth (those render as their own entries).
 * This yields the section's actual provision text without duplicating any
 * descendant clause into its ancestors (the root section otherwise contains
 * the entire document, and wrapper-mediated nesting otherwise leaks nested
 * sections into the parent verbatim).
 */
function ownHtml(sec: HTMLElement): string {
  let out = "";
  for (const child of sec.childNodes) {
    out += serializeWithoutNestedSections(child);
  }
  return out.trim();
}

/**
 * The section's OWN visible text — the whitespace-collapsed text of exactly
 * the content `ownHtml` serializes (subtree minus descendant `div.section`
 * subtrees at any depth). Non-empty when the section carries its own provision
 * text rather than only wrapping nested sub-sections. This is what lets us keep
 * body-only sections: Constitute nests each article's clause text in a bare
 * child `div.section` with no `data-topics` and no heading, so the body lives
 * ONLY there — such a section has topics 0 and heading null but a real ownText.
 * Conversely, a wrapper whose entire content is nested sections (even behind
 * intermediate `<ol>/<li>` wrappers) now yields an empty ownText and is
 * correctly dropped — its content is fully captured by the nested entries.
 */
function ownText(sec: HTMLElement): string {
  let out = "";
  for (const child of sec.childNodes) {
    out += textWithoutNestedSections(child);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Extract the ontology topic keys from a section's `data-topics` attribute. */
function topicKeysFromSection(sec: HTMLElement): string[] {
  const raw = sec.getAttribute("data-topics");
  if (!raw) return [];
  return raw
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean)
    // "…/ontology/lhterm" → "lhterm"
    .map((uri) => uri.split("/").pop() ?? "")
    .filter(Boolean);
}

/**
 * Serialize an element's children into at most `budget` characters, cutting
 * ONLY at clean tag boundaries: whole child nodes are appended while they fit;
 * when the next child would blow the budget and it is an element with room to
 * spare, we descend into it (re-wrapping with its own open/close tags) so a
 * single huge child (e.g. a long <ol>) still yields a partial, VALID excerpt.
 * Returns the accumulated HTML and whether anything was cut.
 */
function truncatedInnerHtml(
  el: HTMLElement,
  budget: number,
): { html: string; truncated: boolean } {
  let out = "";
  for (const child of el.childNodes) {
    const s = child.toString();
    if (out.length + s.length <= budget) {
      out += s;
      continue;
    }
    // Next child doesn't fit whole. If it's an element and meaningful budget
    // remains, descend to fill the remainder at a clean nested boundary.
    if (child.nodeType === 1) {
      const elChild = child as HTMLElement;
      const tag = (elChild.rawTagName ?? "div").toLowerCase();
      const open = `<${elChild.rawTagName}${elChild.rawAttrs ? ` ${elChild.rawAttrs}` : ""}>`;
      const close = `</${tag}>`;
      const innerBudget = budget - out.length - open.length - close.length;
      if (innerBudget > 200) {
        const inner = truncatedInnerHtml(elChild, innerBudget);
        if (inner.html.length > 0) out += open + inner.html + close;
      }
    }
    return { html: out, truncated: true };
  }
  return { html: out, truncated: false };
}

/**
 * The excerpt payload for a tagged section: its FULL inner HTML including
 * nested sub-section divs (the passage a cross-reference pane must show),
 * capped at EXCERPT_MAX_CHARS via clean-tag-boundary truncation. Returns null
 * when even the full subtree's text content is under EXCERPT_MIN_TEXT_CHARS —
 * nothing meaningful to show, so no row is written.
 */
function excerptHtmlForSection(sec: HTMLElement): string | null {
  const text = sec.text.replace(/\s+/g, " ").trim();
  if (text.length < EXCERPT_MIN_TEXT_CHARS) return null;

  const full = sec.innerHTML.trim();
  if (full.length <= EXCERPT_MAX_CHARS) return full;

  const { html } = truncatedInnerHtml(sec, EXCERPT_MAX_CHARS);
  return html.trim() + EXCERPT_TRUNCATION_MARKER;
}

/**
 * Parse a Constitute constitution HTML document into parsed sections.
 * We keep a section entry when it carries topic tags OR its own heading OR its
 * own body text — i.e. the semantically meaningful units (tagged provisions,
 * article/title boundaries, AND the bare body-only sections where Constitute
 * nests an article's clause text). Only the purely-structural wrapper sections —
 * no topics, no heading, and no own text (all content lives in nested children,
 * which become their own entries) — are dropped.
 *
 * Each entry carries BOTH payloads: `html` (own inner HTML, children excluded —
 * stored in `structured_articles`) and `excerptHtml` (full subtree, capped —
 * written to `constitution_topic_excerpts`; null when the subtree has no
 * meaningful text). See the `ParsedSection` doc for why they differ.
 */
export function parseConstitutionHtml(html: string): ParsedSection[] {
  const root = parse(html, {
    // Preserve the full inner markup for reading + excerpts.
    comment: false,
    blockTextElements: {},
  });
  const sections = root.querySelectorAll("div.section");
  const articles: ParsedSection[] = [];

  for (const sec of sections) {
    const sectionId = sec.getAttribute("id") ?? "";
    if (!sectionId) continue;
    const topics = topicKeysFromSection(sec);
    const heading = ownHeading(sec);

    // Keep tagged provisions, titled sections, and body-only sections (a bare
    // child div.section holding an article's clause text). Drop only the
    // purely-structural wrappers whose content is already captured by children.
    if (topics.length === 0 && !heading && !ownText(sec)) continue;

    articles.push({
      sectionId,
      headingLabel: nearestHeading(sec),
      topics,
      html: ownHtml(sec),
      // Only tagged sections produce excerpt rows; skip the work otherwise.
      excerptHtml: topics.length > 0 ? excerptHtmlForSection(sec) : null,
    });
  }

  return articles;
}

// ─── Network resilience ──────────────────────────────────────────────────────

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

function isRetryableDbError(err: unknown): boolean {
  if (isRetryableNetworkError(err)) return true;
  const e = err as { message?: string; status?: number; statusCode?: number };
  const msg = (e?.message ?? "").toLowerCase();
  if (
    /fetch failed|connecttimeout|connect timeout|socket hang up|network|timed? ?out|econnreset|etimedout|eai_again|und_err_/.test(
      msg,
    )
  ) {
    return true;
  }
  const status = e?.status ?? e?.statusCode;
  if (typeof status === "number" && status >= 500 && status <= 599) return true;
  return false;
}

/** Retry ladder (3s/8s/20s) for a transient network OR Neon-HTTP blip. */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    label: string;
    log: (line: string) => void;
    isRetryable?: (err: unknown) => boolean;
    tries?: number;
  },
): Promise<T> {
  const tries = opts.tries ?? 4; // initial + 3 retries
  const backoffs = [3_000, 8_000, 20_000];
  const retryable = opts.isRetryable ?? isRetryableNetworkError;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!retryable(err) || attempt === tries) break;
      const wait = backoffs[Math.min(attempt - 1, backoffs.length - 1)];
      const reason = (err as Error)?.message ?? String(err);
      opts.log(
        `  ↻ ${opts.label}: transient error (${reason}); retry ${attempt}/${tries - 1} in ${Math.round(wait / 1000)}s`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": CONSTITUTE_USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

// ─── Options / summary ───────────────────────────────────────────────────────

export type ConstituteSyncDb = typeof sharedDb;

export interface SyncConstitutionsOptions {
  db?: ConstituteSyncDb;
  /** Parse + resolve everything but write NOTHING (and never stamp freshness). */
  dryRun?: boolean;
  /** Cap the number of constitutions processed (after slug filtering). */
  limit?: number;
  /** Restrict to these Civica jurisdiction slugs. */
  slugs?: string[];
  onProgress?: (line: string) => void;
  /** Politeness delay override (ms) between HTML fetches. Defaults to 400. */
  politenessDelayMs?: number;
}

export interface CountryResult {
  slug: string | null;
  countryId: string;
  country: string;
  consId: string;
  jurisdictionId: string | null;
  matched: boolean;
  articleCount: number;
  excerptCount: number;
  htmlBytes: number;
}

export interface FailedCountry {
  consId: string;
  country: string;
  reason: string;
}

export interface UnmatchedCountry {
  countryId: string;
  country: string;
  isocode: string | null;
}

export interface SyncConstitutionsSummary {
  dryRun: boolean;
  inForceTotal: number;
  considered: number;
  matched: number;
  written: number;
  articlesTotal: number;
  excerptsTotal: number;
  distinctTopicKeys: number;
  results: CountryResult[];
  unmatched: UnmatchedCountry[];
  failed: FailedCountry[];
}

// ─── Country resolution ──────────────────────────────────────────────────────

/**
 * Build a numeric-ISO → alpha-3 lookup from the ISO 3166 dataset baked into the
 * generated JSON. We load it lazily so the module has no import-time network.
 * The dataset is small (~249 rows) and ships alongside the topic taxonomy.
 */
let numericToAlpha3: Record<string, string> | null = null;
async function getNumericToAlpha3(): Promise<Record<string, string>> {
  if (numericToAlpha3) return numericToAlpha3;
  const mod = await import("./iso-3166-numeric.generated.json");
  numericToAlpha3 = (mod.default ?? mod) as Record<string, string>;
  return numericToAlpha3;
}

interface JurisdictionRow {
  id: string;
  slug: string;
  name: string;
  iso3: string | null;
}

interface ResolvedCountry {
  jurisdiction: JurisdictionRow | null;
  isocode: string | null;
}

/**
 * Resolve a Constitute `country_id` to a Civica jurisdiction:
 *   1. explicit slug alias (Kosovo, Palestine).
 *   2. `/locations` numeric isocode → alpha-3 (+ legacy alias) → `iso3` match.
 * Returns `{ jurisdiction: null }` (with the isocode, for reporting) when
 * nothing matches — the caller records it as unmatched rather than guessing.
 */
async function resolveCountry(
  countryId: string,
  bySlug: Map<string, JurisdictionRow>,
  byIso3: Map<string, JurisdictionRow>,
  countryIdToIsocode: Map<string, string>,
): Promise<ResolvedCountry> {
  const aliasSlug = COUNTRY_ID_SLUG_ALIAS[countryId];
  if (aliasSlug) {
    const j = bySlug.get(aliasSlug) ?? null;
    return { jurisdiction: j, isocode: null };
  }

  const isocode = countryIdToIsocode.get(countryId) ?? null;
  if (!isocode) return { jurisdiction: null, isocode: null };

  const numeric = String(parseInt(isocode, 10));
  const num2a3 = await getNumericToAlpha3();
  const alpha3 = NUMERIC_ISO_ALIAS[numeric] ?? num2a3[numeric] ?? null;
  if (!alpha3) return { jurisdiction: null, isocode };

  const j = byIso3.get(alpha3.toUpperCase()) ?? null;
  return { jurisdiction: j, isocode };
}

// ─── Persistence (idempotent upsert) ─────────────────────────────────────────

/**
 * Update-or-insert the `constitutions` row for a jurisdiction (keyed by
 * jurisdictionId — one constitution per country). Never duplicates rows.
 * Returns the constitution id.
 */
export async function upsertConstitution(
  db: ConstituteSyncDb,
  jurisdictionId: string,
  values: {
    constituteProjectId: string;
    year: number | null;
    yearUpdated: number | null;
    fullTextHtml: string;
    structuredArticles: StructuredArticle[];
  },
): Promise<string> {
  const existing = await db
    .select({ id: constitutions.id })
    .from(constitutions)
    .where(eq(constitutions.jurisdictionId, jurisdictionId))
    .limit(1);

  const row = {
    constituteProjectId: values.constituteProjectId,
    year: values.year,
    yearUpdated: values.yearUpdated,
    fullTextHtml: values.fullTextHtml,
    structuredArticles: values.structuredArticles,
    lastFetched: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(constitutions)
      .set(row)
      .where(eq(constitutions.id, existing[0].id));
    return existing[0].id;
  }

  const inserted = await db
    .insert(constitutions)
    .values({ jurisdictionId, ...row })
    .returning({ id: constitutions.id });
  return inserted[0].id;
}

/**
 * Delete + reinsert a country's topic excerpts (idempotent). One row per
 * (section × topic key) across the tagged sections. The stored payload is the
 * section's FULL subtree HTML (`excerptHtml`, capped) — NOT the deduplicated
 * `html` used by `structured_articles` — so the cross-reference pane always
 * shows the passage, not a hollow heading. Sections whose subtree has no
 * meaningful text (`excerptHtml === null`) are skipped. Returns rows written.
 */
export async function replaceTopicExcerpts(
  db: ConstituteSyncDb,
  jurisdictionId: string,
  constitutionId: string,
  articles: ParsedSection[],
): Promise<number> {
  await db
    .delete(constitutionTopicExcerpts)
    .where(eq(constitutionTopicExcerpts.jurisdictionId, jurisdictionId));

  const rows = articles.flatMap((a) => {
    if (!a.excerptHtml) return [];
    const excerptHtml = a.excerptHtml;
    return a.topics.map((topicKey) => ({
      jurisdictionId,
      constitutionId,
      topicKey,
      topicLabel: getTopicLabel(topicKey),
      sectionId: a.sectionId,
      excerptHtml,
      articleLabel: a.headingLabel,
    }));
  });
  if (rows.length === 0) return 0;

  // Byte-aware chunking: excerpts can now be up to ~8KB each, so cap each
  // INSERT by accumulated payload size as well as row count to stay far below
  // the Neon HTTP body limit.
  const MAX_CHUNK_ROWS = 100;
  const MAX_CHUNK_BYTES = 512_000;
  let batch: typeof rows = [];
  let batchBytes = 0;
  for (const row of rows) {
    const size = row.excerptHtml.length + 200; // payload + per-row overhead
    if (
      batch.length > 0 &&
      (batch.length >= MAX_CHUNK_ROWS || batchBytes + size > MAX_CHUNK_BYTES)
    ) {
      await db.insert(constitutionTopicExcerpts).values(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push(row);
    batchBytes += size;
  }
  if (batch.length > 0) {
    await db.insert(constitutionTopicExcerpts).values(batch);
  }
  return rows.length;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

function toYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Run the constitution sync. Fetches the in-force constitution list, resolves
 * each to a Civica jurisdiction, fetches + parses its HTML, and (unless
 * `dryRun`) upserts the `constitutions` row and rebuilds its topic excerpts.
 * Per-country failures are isolated (skip-and-continue) and reported; a clean
 * run stamps `sources.last_sync_at` via `markSourcesSynced`.
 */
export async function syncConstitutions(
  options: SyncConstitutionsOptions = {},
): Promise<SyncConstitutionsSummary> {
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const dryRun = options.dryRun ?? false;
  const politenessDelay = options.politenessDelayMs ?? POLITENESS_DELAY_MS;

  const summary: SyncConstitutionsSummary = {
    dryRun,
    inForceTotal: 0,
    considered: 0,
    matched: 0,
    written: 0,
    articlesTotal: 0,
    excerptsTotal: 0,
    distinctTopicKeys: 0,
    results: [],
    unmatched: [],
    failed: [],
  };
  const seenTopicKeys = new Set<string>();

  // ── 1. Load jurisdictions + the Constitute directory + locations map ──
  log("Loading Civica jurisdictions …");
  const jurRows = (await withRetry(
    () =>
      db
        .select({
          id: jurisdictions.id,
          slug: jurisdictions.slug,
          name: jurisdictions.name,
          iso3: jurisdictions.iso3,
        })
        .from(jurisdictions),
    { label: "load jurisdictions", log, isRetryable: isRetryableDbError },
  )) as JurisdictionRow[];
  const bySlug = new Map(jurRows.map((j) => [j.slug, j]));
  const byIso3 = new Map<string, JurisdictionRow>();
  for (const j of jurRows) if (j.iso3) byIso3.set(j.iso3.toUpperCase(), j);

  log("Fetching Constitute directory (/constitutions) …");
  const allRows = await withRetry(
    () =>
      fetchJson<ConstituteConstitutionRow[]>(
        `${CONSTITUTE_BASE}/constitutions?lang=en`,
      ),
    { label: "GET /constitutions", log },
  );
  const inForce = allRows.filter((r) => r.in_force === true);
  summary.inForceTotal = inForce.length;
  log(`  ${inForce.length} in-force constitutions.`);

  log("Fetching Constitute locations (/locations) …");
  const locations = await withRetry(
    () =>
      fetchJson<ConstituteLocationsResponse[]>(
        `${CONSTITUTE_BASE}/locations?lang=en`,
      ),
    { label: "GET /locations", log },
  );
  const countryIdToIsocode = new Map<string, string>();
  for (const continent of locations) {
    for (const c of continent.countries ?? []) {
      countryIdToIsocode.set(c.id, c.isocode);
    }
  }

  // ── 2. Filter by slug (resolve first so slug filter works pre-fetch) ──
  const wantSlugs = options.slugs ? new Set(options.slugs) : null;
  const queue: Array<{
    row: ConstituteConstitutionRow;
    jurisdiction: JurisdictionRow | null;
    isocode: string | null;
  }> = [];
  for (const row of inForce) {
    const { jurisdiction, isocode } = await resolveCountry(
      row.country_id,
      bySlug,
      byIso3,
      countryIdToIsocode,
    );
    if (!jurisdiction) {
      summary.unmatched.push({
        countryId: row.country_id,
        country: row.country,
        isocode,
      });
      continue;
    }
    if (wantSlugs && !wantSlugs.has(jurisdiction.slug)) continue;
    queue.push({ row, jurisdiction, isocode });
  }
  summary.matched = queue.length + 0; // matched = resolvable (before limit)

  const toProcess =
    options.limit != null ? queue.slice(0, options.limit) : queue;
  summary.considered = toProcess.length;
  log(
    `\nProcessing ${toProcess.length} constitution(s)` +
      (options.limit != null ? ` (limit ${options.limit})` : "") +
      (dryRun ? " — DRY RUN (no writes)" : "") +
      `.\n`,
  );

  // ── 3. Per-country: fetch HTML → parse → (write) ──
  for (let i = 0; i < toProcess.length; i++) {
    const { row, jurisdiction } = toProcess[i];
    const j = jurisdiction as JurisdictionRow;
    if (i > 0) await new Promise((r) => setTimeout(r, politenessDelay));

    try {
      log(`[${i + 1}/${toProcess.length}] ${j.name} (${row.id}) …`);
      const doc = await withRetry(
        () =>
          fetchJson<ConstituteHtmlResponse>(
            `${CONSTITUTE_BASE}/html?cons_id=${encodeURIComponent(row.id)}&lang=en`,
          ),
        { label: `GET /html ${row.id}`, log },
      );
      const html = doc.html ?? "";
      const articles = parseConstitutionHtml(html);
      // Excerpt rows come only from tagged sections with a meaningful subtree.
      const excerptRows = articles.reduce(
        (n, a) => n + (a.excerptHtml ? a.topics.length : 0),
        0,
      );
      for (const a of articles)
        for (const t of a.topics) seenTopicKeys.add(t);

      const result: CountryResult = {
        slug: j.slug,
        countryId: row.country_id,
        country: row.country,
        consId: row.id,
        jurisdictionId: j.id,
        matched: true,
        articleCount: articles.length,
        excerptCount: excerptRows,
        htmlBytes: Buffer.byteLength(html, "utf8"),
      };

      if (!dryRun) {
        // structured_articles keeps the deduplicated 4-field shape — the
        // excerpt payload is written to constitution_topic_excerpts only.
        const storedArticles: StructuredArticle[] = articles.map(
          ({ sectionId, headingLabel, topics, html: sectionHtml }) => ({
            sectionId,
            headingLabel,
            topics,
            html: sectionHtml,
          }),
        );
        const constitutionId = await withRetry(
          () =>
            upsertConstitution(db, j.id, {
              constituteProjectId: row.id,
              year: toYear(row.year_enacted),
              yearUpdated: toYear(row.year_updated),
              fullTextHtml: html,
              structuredArticles: storedArticles,
            }),
          {
            label: `upsert ${row.id}`,
            log,
            isRetryable: isRetryableDbError,
          },
        );
        const written = await withRetry(
          () =>
            replaceTopicExcerpts(db, j.id, constitutionId, articles),
          {
            label: `excerpts ${row.id}`,
            log,
            isRetryable: isRetryableDbError,
          },
        );
        result.excerptCount = written;
        summary.written++;
      }

      summary.articlesTotal += result.articleCount;
      summary.excerptsTotal += result.excerptCount;
      summary.results.push(result);
      log(
        `  ✓ ${result.articleCount} articles, ${result.excerptCount} topic excerpts, ${(result.htmlBytes / 1024).toFixed(0)}KB`,
      );
    } catch (err) {
      const reason = (err as Error)?.message ?? String(err);
      summary.failed.push({ consId: row.id, country: row.country, reason });
      log(`⚠ skipped ${row.country} (${row.id}): ${reason}`);
      continue;
    }
  }

  summary.distinctTopicKeys = seenTopicKeys.size;

  // ── 4. Freshness stamp — ONLY the sanctioned path, ONLY when rows written ──
  await markSourcesSynced(CONSTITUTE_SOURCE_ID, {
    rowsWritten: summary.written,
    dryRun,
    executor: db,
  });

  return summary;
}

/** Pretty-print a run summary to a log sink. */
export function reportSyncSummary(
  summary: SyncConstitutionsSummary,
  log: (line: string) => void = (line) => console.log(line),
): void {
  log("\n========================================================");
  log(
    `  Constitution sync ${summary.dryRun ? "— DRY RUN (nothing written)" : "— APPLIED"}`,
  );
  log("========================================================\n");
  log(`  In-force constitutions (Constitute): ${summary.inForceTotal}`);
  log(`  Matched to a Civica jurisdiction:    ${summary.matched}`);
  log(`  Considered this run:                 ${summary.considered}`);
  if (!summary.dryRun) log(`  Written (constitutions rows):        ${summary.written}`);
  log(`  Structured articles parsed:          ${summary.articlesTotal}`);
  log(`  Topic excerpts:                      ${summary.excerptsTotal}`);
  log(`  Distinct topic keys seen:            ${summary.distinctTopicKeys}`);

  if (summary.unmatched.length > 0) {
    log(`\n  UNMATCHED countries (${summary.unmatched.length}) — no Civica jurisdiction:`);
    for (const u of summary.unmatched)
      log(`    · ${u.country} (${u.countryId}, isocode ${u.isocode ?? "—"})`);
  }
  if (summary.failed.length > 0) {
    log(`\n  FAILED (${summary.failed.length}) — skipped after retries:`);
    for (const f of summary.failed)
      log(`    ⚠ ${f.country} (${f.consId}): ${f.reason}`);
  }
  log("");
}
