/**
 * ingest-vparty-positions — match V-Dem V-Party v2 ideology positions onto
 * Civica's `legislature_parties` and store them in `party_positions`.
 *
 * Contract: plan/party-ideology-sourcing-resolution-v1.md (§3 matching, §4
 * provenance, §5 gap handling). Powers the cross-country party browser +
 * ideology compass.
 *
 * ── Source data ──────────────────────────────────────────────────────────
 * `scripts/data/vparty-positions-v2.csv` — a slim, checked-in extract of the
 * V-Party v2 dataset (the frozen Feb-2022 academic release, coverage through
 * 2019). One row per V-Party party at its MOST RECENT coded year that carries
 * BOTH compass axes, with columns:
 *   v2paid, country_text_id (ISO3), v2paenname, v2paorname, v2pashname, year,
 *   v2pariglef, v2pariglef_ord, v2xpa_antiplural, v2xpa_popul
 * The extract was produced from the authentic V-Party dataset bundled by the
 * `vdemdata` R package (github.com/vdeminstitute/vdemdata, `data/vparty.RData`)
 * — the resolution's documented access path (§2.2). V-Party party identity IS
 * Party Facts (Döring & Regel 2019), so the harmonized English / original /
 * short names in the extract are the authentic matching surface (§2.4).
 *
 * ── Matching (§3.1) ──────────────────────────────────────────────────────
 * Per country (ISO3), each codeable Civica party is matched to a V-Party party
 * by, in priority order:
 *   1. exact  — normalized English / original / short name, or a parenthetical
 *               abbreviation ("Christian Democratic Union (CDU)" → CDU) equal
 *               to a normalized V-Party name/short-name.
 *   2. abbrev — the Civica party's own short token (all-caps acronym or paren
 *               abbrev) equal to a V-Party short name.
 *   3. token  — stop-word-tolerant token overlap (Jaccard ≥ 0.6 or full
 *               containment) against English / original names.
 * Accents stripped, punctuation removed, generic party words dropped.
 *
 * Aggregate / procedural buckets (Others, Independents, Crossbench, Divers,
 * party-list, vacant, …) are NEVER matched — they carry no ideology by
 * construction and are excluded from the codeable denominator (§1, §5).
 *
 * ── Provenance discipline ────────────────────────────────────────────────
 * A Civica party with no V-Party match gets NO `party_positions` row — the UI
 * renders an honest "ideology not recorded" state, never a fabricated position
 * (§5). Freshness is stamped ONLY via `markSourcesSynced("vparty", …)` and only
 * when rows were actually written (never on a dry run).
 *
 * Match confidence (§4.2): every written row carries `match_confidence`.
 *   · exact / abbrev matches → 'high'  (displayable — the read layer surfaces
 *                                        a `position`)
 *   · fuzzy token matches    → 'review' (kept in the table for a curation pass
 *                                        but NOT displayed — a wrong ideology is
 *                                        worse than an honest "not recorded")
 *   · ANY party in a one-party / non-competitive legislature (see
 *     NON_COMPETITIVE_ISO3) → 'review', regardless of match method — such a
 *     party has no competitive left–right position to plot (§3.3 mode B, §5).
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *   npx tsx scripts/ingest-vparty-positions.ts            # dry-run (default)
 *   npx tsx scripts/ingest-vparty-positions.ts --dry-run  # explicit dry-run
 *   npx tsx scripts/ingest-vparty-positions.ts --apply    # write party_positions
 *   (npm run ingest:vparty  → the --apply form)
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { partyPositions } from "../src/lib/db/schema";
import { markSourcesSynced } from "../src/lib/db/source-freshness";

const SOURCE_ID = "vparty";
const CSV_PATH = join(process.cwd(), "scripts", "data", "vparty-positions-v2.csv");

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY; // dry-run is the default; --dry-run is also accepted.

// ── CSV parsing (quote-aware, single-line fields) ────────────────────────────
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((v) => v.replace(/\r$/, ""));
}

interface VPartyRow {
  vpartyId: number;
  iso3: string;
  nameEn: string;
  nameOr: string;
  nameSh: string;
  year: number;
  econLR: number;
  econLROrd: number | null;
  antiPlural: number;
  populism: number | null;
  // Precomputed matching surfaces. The Party Facts crosswalk (§2.4) gives every
  // historical / alternate / short name for this core party — this is what
  // recovers post-2019 renames the resolution flags (§3.3 failure mode A), e.g.
  // "National Rally" ↔ the same core party V-Party coded as "Front National".
  /** Stemmed whole-name exact keys: EN + OR + every Party Facts alias. */
  exactKeys: Set<string>;
  /** Short-name / acronym exact keys: `v2pashname` + short Party Facts aliases. */
  shortKeys: Set<string>;
  /** Content-token sets for the fuzzy fallback (one per name surface). */
  tokenSets: Set<string>[];
}

// ── Name normalization ───────────────────────────────────────────────────────
// Stop words dropped before token-overlap. Deliberately limited to true
// function words + the ubiquitous "party" — NOT discriminating content words
// like "national"/"democratic"/"union"/"front", which distinguish real parties
// ("National Rally" vs "Democratic Party") and whose removal both loses and
// fakes matches.
const STOP_WORDS = new Set([
  "party",
  "parties",
  "the",
  "of",
  "for",
  "and",
  "a",
  "an",
  "und",
  "de",
  "del",
  "la",
  "le",
  "les",
  "el",
  "los",
  "las",
  "das",
  "der",
  "die",
  "du",
  "et",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lowercased, accent-stripped, punctuation-free, whitespace-collapsed. */
function normalize(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripAccents(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light English stemmer — collapses the plural/singular gap the resolution
 * flags as recoverable matcher residue (§3.3 failure mode C:
 * "Conservatives" ↔ "Conservative"). Deliberately minimal (trailing
 * -ies/-es/-s only) so it never over-collapses distinct names.
 */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/** Stemmed, stop-word-free content tokens (for token-overlap). */
function contentTokens(raw: string | null | undefined): Set<string> {
  const norm = normalize(raw);
  if (!norm) return new Set();
  return new Set(
    norm
      .split(" ")
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
      .map(stem),
  );
}

/** Whole-name key: normalized + per-token stemmed (for the exact compare). */
function normalizeStemmed(raw: string | null | undefined): string {
  const norm = normalize(raw);
  if (!norm) return "";
  return norm.split(" ").map(stem).join(" ");
}

/**
 * Pull an abbreviation candidate out of a Civica party name:
 *   - the parenthetical, e.g. "Christian Democratic Union (CDU)" → "CDU"
 *   - or an all-caps / mixed acronym token in the bare name, e.g. "PSOE".
 * Returns the NORMALIZED abbreviation, or "" if none.
 */
function extractAbbrev(rawName: string): string {
  const paren = rawName.match(/\(([^)]+)\)/);
  if (paren) {
    const inside = paren[1].trim();
    // Only treat short, acronym-like parentheticals as abbreviations.
    if (inside.length <= 12 && /[A-Za-z0-9]/.test(inside)) {
      return normalize(inside).replace(/\s+/g, "");
    }
  }
  // An all-caps acronym token in the bare name (≥2 chars, no lowercase).
  const bare = rawName.replace(/\([^)]*\)/g, " ");
  const acronym = bare
    .split(/\s+/)
    .find((t) => t.length >= 2 && t.length <= 8 && /^[A-Z0-9.\-]+$/.test(t) && /[A-Z]/.test(t));
  return acronym ? normalize(acronym).replace(/\s+/g, "") : "";
}

/** Name with any parenthetical removed, for the primary exact/token compare. */
function bareName(rawName: string): string {
  return rawName.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

// ── One-party / non-competitive legislatures — never a competitive position ──
//
// Placing a one-party-state ruling party (or any party seated only inside a
// non-competitive legislature) on a COMPETITIVE economic left–right compass is
// misleading: V-Party codes multiparty competition, and these systems have no
// competitive left–right position by construction (resolution §3.3 failure
// mode B, §5 "One-party states … never 'not recorded' (a different, correct
// reason)"). The resolution names China's CCP, North Korea's WPK, and Vietnam's
// CP explicitly; the owner's brief adds Cuba's PCC, Eritrea's PFDJ, and Laos's
// LPRP.
//
// Preferred signal is the regime taxonomy already in the DB
// (`government_taxonomies`): `structural_family = 'one_party_state'` cleanly
// covers CHN/CUB/LAO/PRK/VNM, but it does NOT cover every non-competitive case
// the brief requires — Eritrea is classified `structural_family='other'`, and
// Turkmenistan/Syria are `presidential_republic` with a `civilian_dictatorship`
// regime. So we key exclusion off an EXPLICIT, documented ISO3 list (the
// robust, auditable path the brief sanctions), each entry justified by its live
// taxonomy row (probed 2026-07-06, taxonomy_version '2026_v1'). Parties in
// these countries get NO displayable position: their `party_positions` rows (if
// the matcher lands one) are written with match_confidence='review' and the
// read layer returns position:null → the UI shows "ideology not recorded"
// (§5 gap treatment), never a fabricated competitive dot.
const NON_COMPETITIVE_ISO3 = new Set<string>([
  // structural_family = 'one_party_state' (regime: civilian_dictatorship)
  "CHN", // China — Chinese Communist Party
  "CUB", // Cuba — Communist Party of Cuba
  "LAO", // Laos — Lao People's Revolutionary Party (LPRP)
  "PRK", // North Korea — Workers' Party of Korea
  "VNM", // Vietnam — Communist Party of Vietnam
  // non-competitive but classified elsewhere in the taxonomy — explicit here
  "ERI", // Eritrea — People's Front for Democracy and Justice (PFDJ); sf='other'
  "TKM", // Turkmenistan — one dominant party; sf='presidential_republic' dictatorship
  "SYR", // Syria — Ba'ath-dominated People's Council; sf='presidential_republic' dictatorship
]);

function isNonCompetitive(iso3: string): boolean {
  return NON_COMPETITIVE_ISO3.has(iso3.toUpperCase());
}

// ── Aggregate / procedural buckets — never codeable (§1, §5) ─────────────────
const AGGREGATE_RE =
  /^(others?|independents?|independent\s|non[- ]?attached|unaffiliated|crossbench|divers|vacant|elected members|party[- ]list|nominated members|appointed members|ensemble\b|presidential majority|led states|other members|no party|not affiliated)/i;

function isAggregateBucket(name: string): boolean {
  return AGGREGATE_RE.test(name.trim());
}

// ── Load & index the V-Party extract, per country ────────────────────────────
function loadVParty(): Map<string, VPartyRow[]> {
  const text = readFileSync(CSV_PATH, "utf8");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const byIso3 = new Map<string, VPartyRow[]>();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;
    const nameEn = cols[idx["v2paenname"]] ?? "";
    const nameOr = cols[idx["v2paorname"]] ?? "";
    const nameSh = cols[idx["v2pashname"]] ?? "";
    const iso3 = (cols[idx["country_text_id"]] ?? "").trim();
    const econLR = Number(cols[idx["v2pariglef"]]);
    const antiPlural = Number(cols[idx["v2xpa_antiplural"]]);
    if (!iso3 || !Number.isFinite(econLR) || !Number.isFinite(antiPlural)) continue;

    const ordRaw = Number(cols[idx["v2pariglef_ord"]]);
    const popRaw = Number(cols[idx["v2xpa_popul"]]);
    const aliasField = cols[idx["aliases"]] ?? "";
    const aliases = aliasField
      .split("|")
      .map((a) => a.trim())
      .filter(Boolean);

    const exactKeys = new Set<string>();
    const shortKeys = new Set<string>();
    const tokenSets: Set<string>[] = [];

    // Seed the canonical V-Party names.
    for (const n of [nameEn, nameOr]) {
      if (!n) continue;
      const key = normalizeStemmed(bareName(n));
      if (key) exactKeys.add(key);
      const toks = contentTokens(bareName(n));
      if (toks.size > 0) tokenSets.push(toks);
      // A parenthetical inside a V-Party name is itself a short key.
      const ab = extractAbbrev(n);
      if (ab) shortKeys.add(ab);
    }
    const shCanonical = normalize(nameSh).replace(/\s+/g, "");
    if (shCanonical) shortKeys.add(shCanonical);

    // Fold in every Party Facts alias (the rename-recovery crosswalk).
    for (const a of aliases) {
      const asShort = normalize(a).replace(/\s+/g, "");
      const looksAcronym =
        asShort.length >= 2 &&
        asShort.length <= 8 &&
        /[A-Z]/.test(a) &&
        !/\s/.test(a.trim());
      if (looksAcronym) {
        shortKeys.add(asShort);
      }
      const bare = bareName(a);
      const key = normalizeStemmed(bare);
      if (key) exactKeys.add(key);
      const toks = contentTokens(bare);
      if (toks.size > 0) tokenSets.push(toks);
      const ab = extractAbbrev(a);
      if (ab) shortKeys.add(ab);
    }

    const row: VPartyRow = {
      vpartyId: Number(cols[idx["v2paid"]]),
      iso3,
      nameEn,
      nameOr,
      nameSh,
      year: Number(cols[idx["year"]]),
      econLR,
      econLROrd: Number.isFinite(ordRaw) ? Math.round(ordRaw) : null,
      antiPlural,
      populism: Number.isFinite(popRaw) ? popRaw : null,
      exactKeys,
      shortKeys,
      tokenSets,
    };
    if (!byIso3.has(iso3)) byIso3.set(iso3, []);
    byIso3.get(iso3)!.push(row);
  }
  return byIso3;
}

// ── Matching ─────────────────────────────────────────────────────────────────
type MatchMethod = "exact" | "abbrev" | "token";

interface Match {
  vparty: VPartyRow;
  method: MatchMethod;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function containment(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (!large.has(t)) return false;
  return true;
}

function countShared(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function matchParty(civicaName: string, candidates: VPartyRow[]): Match | null {
  const bare = bareName(civicaName);
  const normBare = normalizeStemmed(bare);
  const abbrev = extractAbbrev(civicaName);
  const tokens = contentTokens(bare);
  const isSingleToken = normBare.split(" ").filter(Boolean).length === 1;

  // 1. exact — stemmed bare name equals any V-Party name / Party Facts alias.
  for (const c of candidates) {
    if (normBare && c.exactKeys.has(normBare)) {
      return { vparty: c, method: "exact" };
    }
  }

  // 2. abbrev — a parenthetical / acronym abbreviation, OR a bare single-token
  //    name (e.g. "ANC", "SPD", "ZANU-PF"), equals a V-Party short name /
  //    short Party Facts alias.
  const shortSelf =
    abbrev || (isSingleToken ? normBare.replace(/\s+/g, "") : "");
  if (shortSelf && shortSelf.length >= 2) {
    for (const c of candidates) {
      if (c.shortKeys.has(shortSelf)) {
        return { vparty: c, method: "abbrev" };
      }
    }
  }

  // 3. token — conservative fuzzy fallback. Provenance is load-bearing: a wrong
  //    ideology is worse than an honest "not recorded" (§5), so the bar is high.
  //    A candidate wins only with STRONG multi-token evidence:
  //      · Jaccard ≥ 0.6 with ≥2 shared content tokens, OR
  //      · full containment of the Civica tokens with ≥2 shared tokens,
  //    and in either case at least one shared token must be distinctive
  //    (length ≥ 5) so a single generic word ("national", "people", "alliance")
  //    can never carry the match. Single-token names are handled by the exact /
  //    abbrev paths (stemming already unifies "Socialistes" ↔ "Socialist"), so
  //    they never reach this fuzzy branch.
  let best: { c: VPartyRow; score: number } | null = null;
  for (const c of candidates) {
    for (const cand of c.tokenSets) {
      const shared = countShared(tokens, cand);
      if (shared < 2) continue;
      let hasDistinctive = false;
      for (const t of tokens) {
        if (t.length >= 5 && cand.has(t)) {
          hasDistinctive = true;
          break;
        }
      }
      if (!hasDistinctive) continue;
      const j = jaccard(tokens, cand);
      const contained = containment(tokens, cand);
      const score = contained ? Math.max(j, 0.6) : j;
      if (score >= 0.6 && (!best || score > best.score)) best = { c, score };
    }
  }
  if (best) return { vparty: best.c, method: "token" };

  return null;
}

// ── Civica party rows ────────────────────────────────────────────────────────
interface CivicaParty {
  id: string;
  partyName: string;
  seatCount: number;
  iso3: string;
  country: string;
}

async function loadCivicaParties(): Promise<CivicaParty[]> {
  const rows = await neonSql`
    SELECT lp.id, lp.party_name, lp.seat_count, j.iso3, j.name AS country
    FROM legislature_parties lp
    JOIN government_bodies gb ON lp.body_id = gb.id
    JOIN jurisdictions j ON gb.jurisdiction_id = j.id
    WHERE j.iso3 IS NOT NULL
    ORDER BY j.name, lp.seat_count DESC
  `;
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    partyName: String(r.party_name),
    seatCount: Number(r.seat_count ?? 0),
    iso3: String(r.iso3),
    country: String(r.country),
  }));
}

async function main() {
  console.log(
    `=== V-Party ideology ingest — ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY (writing party_positions)"} ===\n`,
  );

  const vpartyByIso3 = loadVParty();
  const vpartyCount = [...vpartyByIso3.values()].reduce((n, a) => n + a.length, 0);
  console.log(
    `Loaded ${vpartyCount} V-Party parties across ${vpartyByIso3.size} countries from the extract.`,
  );

  const civica = await loadCivicaParties();
  const totalSeats = civica.reduce((n, p) => n + p.seatCount, 0);
  console.log(
    `Loaded ${civica.length} Civica party rows across ${new Set(civica.map((p) => p.iso3)).size} countries (${totalSeats} seats).\n`,
  );

  // Per-country pass.
  const byCountry = new Map<string, CivicaParty[]>();
  for (const p of civica) {
    if (!byCountry.has(p.country)) byCountry.set(p.country, []);
    byCountry.get(p.country)!.push(p);
  }

  type MatchConfidence = "high" | "review";
  interface Landed {
    party: CivicaParty;
    match: Match;
    confidence: MatchConfidence;
  }
  const landed: Landed[] = [];
  const methodCounts: Record<MatchMethod, number> = { exact: 0, abbrev: 0, token: 0 };
  const confidenceCounts: Record<MatchConfidence, number> = { high: 0, review: 0 };
  let aggregate = 0;
  let codeable = 0;
  let nonCompetitive = 0;

  // Guard: within a country, don't attach the same V-Party party to two Civica
  // rows (would be a spurious duplicate) — keep the higher-seat Civica row.
  const usedVpartyPerCountry = new Map<string, Set<number>>();

  const countryNames = [...byCountry.keys()].sort();
  for (const country of countryNames) {
    const parties = byCountry.get(country)!;
    const iso3 = parties[0].iso3;
    const candidates = vpartyByIso3.get(iso3) ?? [];
    const used = usedVpartyPerCountry.get(country) ?? new Set<number>();
    usedVpartyPerCountry.set(country, used);

    let cMatched = 0;
    let cCodeable = 0;
    // Higher-seat rows first so they win a contested V-Party party.
    const ordered = [...parties].sort((a, b) => b.seatCount - a.seatCount);
    for (const p of ordered) {
      if (isAggregateBucket(p.partyName)) {
        aggregate += 1;
        continue;
      }
      codeable += 1;
      cCodeable += 1;
      if (candidates.length === 0) continue;
      const m = matchParty(p.partyName, candidates);
      if (!m) continue;
      // Civica legitimately stores the same party as several distinct rows
      // (e.g. "Labour Party" + "Labour", or a party split across chambers) —
      // each is a real seat-holding row and correctly carries the position.
      // So high-confidence (exact / abbrev) matches may attach to more than one
      // Civica row. A FUZZY (token) match is deduped first-wins per country so a
      // loose overlap can't spuriously fan one V-Party party across unrelated
      // small parties.
      if (m.method === "token" && used.has(m.vparty.vpartyId)) continue;
      used.add(m.vparty.vpartyId);
      // Confidence (resolution §4.2): exact / abbrev → 'high' (displayable);
      // fuzzy token → 'review' (kept for curation, never displayed as-is). A
      // party in a non-competitive legislature is ALWAYS 'review' regardless of
      // how cleanly it matched — a one-party-state party has no competitive
      // left–right position to display (§3.3 failure mode B, §5).
      const nonComp = isNonCompetitive(p.iso3);
      const confidence: MatchConfidence =
        m.method === "token" || nonComp ? "review" : "high";
      if (nonComp) nonCompetitive += 1;
      landed.push({ party: p, match: m, confidence });
      methodCounts[m.method] += 1;
      confidenceCounts[confidence] += 1;
      cMatched += 1;
    }

    if (candidates.length > 0 && cCodeable > 0) {
      console.log(
        `  ${country.padEnd(28)} ${String(cMatched).padStart(3)}/${String(cCodeable).padEnd(3)} codeable parties matched`,
      );
    } else if (candidates.length === 0) {
      console.log(`  ${country.padEnd(28)}  —   no V-Party coverage`);
    }
  }

  const matchedSeats = landed.reduce((n, l) => n + l.party.seatCount, 0);
  console.log("\n=== Coverage ===");
  console.log(`  Parties matched (all rows) : ${landed.length} / ${civica.length}` +
    ` (${((landed.length / civica.length) * 100).toFixed(1)}%)`);
  console.log(`  Parties matched (codeable) : ${landed.length} / ${codeable}` +
    ` (${((landed.length / codeable) * 100).toFixed(1)}%)`);
  console.log(`  Seats covered              : ${matchedSeats} / ${totalSeats}` +
    ` (${((matchedSeats / totalSeats) * 100).toFixed(1)}%)`);
  console.log(`  Aggregate rows skipped     : ${aggregate}`);
  console.log(
    `  Match methods              : exact ${methodCounts.exact} · abbrev ${methodCounts.abbrev} · token ${methodCounts.token}`,
  );
  console.log(
    `  Confidence                 : high ${confidenceCounts.high} (displayable) · review ${confidenceCounts.review} (curation queue)`,
  );
  console.log(
    `  Non-competitive → review   : ${nonCompetitive} (one-party / non-electoral legislatures)`,
  );

  if (DRY_RUN) {
    console.log("\nDry run — no rows written. Re-run with --apply to persist.");
    return;
  }

  // ── Write party_positions (upsert on legislature_party_id) ─────────────────
  let written = 0;
  for (const { party, match, confidence } of landed) {
    const v = match.vparty;
    await db
      .insert(partyPositions)
      .values({
        legislaturePartyId: party.id,
        sourceId: SOURCE_ID,
        vpartyId: v.vpartyId,
        vpartyNameEn: v.nameEn || null,
        economicLeftRight: v.econLR,
        economicLrOrd: v.econLROrd,
        antiPluralism: v.antiPlural,
        populism: v.populism,
        codedYear: v.year,
        matchMethod: match.method,
        matchConfidence: confidence,
      })
      .onConflictDoUpdate({
        target: partyPositions.legislaturePartyId,
        set: {
          sourceId: SOURCE_ID,
          vpartyId: v.vpartyId,
          vpartyNameEn: v.nameEn || null,
          economicLeftRight: v.econLR,
          economicLrOrd: v.econLROrd,
          antiPluralism: v.antiPlural,
          populism: v.populism,
          codedYear: v.year,
          matchMethod: match.method,
          matchConfidence: confidence,
        },
      });
    written += 1;
  }

  console.log(`\nWrote ${written} party_positions rows.`);

  // Freshness stamped ONLY when rows were actually written (the helper applies
  // the same `rowsWritten > 0` gate internally). Never on a dry run.
  const stamped = await markSourcesSynced(SOURCE_ID, { rowsWritten: written });
  console.log(
    stamped.length > 0
      ? `Stamped sources.last_sync_at for: ${stamped.join(", ")}`
      : "No freshness stamp (nothing written).",
  );

  // Sanity: total rows now present.
  const [{ n }] = (await neonSql`SELECT count(*)::int AS n FROM party_positions`) as Array<{
    n: number;
  }>;
  console.log(`party_positions now holds ${n} rows.`);
}

main().catch((err) => {
  console.error("V-Party ingest failed:", err);
  process.exit(1);
});
