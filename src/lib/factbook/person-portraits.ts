/**
 * person-portraits — the SINGLE implementation of Wikidata P18 portrait +
 * P569 birthdate enrichment for the `persons` table.
 *
 * This module owns the low-level media plumbing that used to live inline in
 * `officeholders-sync.ts`:
 *   - the batched SPARQL P18/P569 lookup keyed on person Q-IDs,
 *   - resolving a Commons `Special:FilePath/<file>` URL to the bare file name,
 *   - the free-license filter for Commons `LicenseShortName`, and
 *   - the batched Commons `imageinfo`/`extmetadata` license+author fetch.
 *
 * Both callers use this one implementation:
 *   - `officeholders-sync.ts` (the factbook head-of-state / head-of-government
 *     enrichment) imports the helpers so its behaviour is UNCHANGED — it still
 *     de-dups and applies portraits/birthdates per current principal
 *     officeholder, but the plumbing is no longer duplicated; and
 *   - `enrich-person-portraits.ts` (the CLI) calls `enrichPersonPortraits()`
 *     to backfill EVERY `persons` row that has a `wikidata_qid` but no
 *     `photo_url` — the ~1.9k cabinet ministers the QID backfill just
 *     identified, plus any future delta.
 *
 * Storage conventions are FIXED and match the existing columns exactly:
 *   - `persons.photo_url`     = the bare Commons FILE NAME (NOT a URL). The
 *     renderer builds the CDN thumbnail via `wikimediaUrl(file, size)`, so no
 *     local image files are ever written.
 *   - `persons.photo_license` = Commons `LicenseShortName` (free-only).
 *   - `persons.photo_credit`  = Commons `Artist` (else `Credit`, else
 *     "Wikimedia Commons").
 *   - `persons.date_of_birth` = P569, ISO `yyyy-mm-dd`.
 *
 * Honest-data posture: a portrait is proposed ONLY when the Commons file's
 * license is genuinely free (PD / any CC / recognised open-government
 * licence). A non-free or unreadable license is SKIPPED → the person keeps the
 * monogram. A missing DOB stays null. An existing `photo_url` is NEVER
 * overwritten. Nothing is fabricated.
 *
 * On a real apply the caller stamps `sources.last_sync_at` via
 * `markSourcesSynced("wikidata", …)` — the one sanctioned path — and only when
 * rows were actually written.
 */
import { eq, isNull, and, isNotNull, or } from "drizzle-orm";

import { db as sharedDb } from "@/lib/db";
import { persons } from "@/lib/db/schema";
import { sparqlQuery, extractQid } from "@/lib/data/wikidata";
import { markSourcesSynced } from "@/lib/db/source-freshness";

const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const COMMONS_USER_AGENT =
  "CivicaAtlas/1.0 (https://civicaatlas.org; admin@civicaatlas.org)";

/** Anything that can run the Drizzle queries below — the shared `db` client
 *  or a compatible instance. */
export type PersonPortraitsDb = typeof sharedDb;

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** P18 image (Commons file) + P569 birthdate per person, VALUES-batched. */
export function mediaQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  return `
SELECT ?person ?image ?dob WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person wdt:P18 ?image . }
  OPTIONAL { ?person wdt:P569 ?dob . }
}
`;
}

/**
 * Parse a Wikidata P569 binding value into an ISO `yyyy-mm-dd` date, or null.
 *
 * Wikidata date literals are `xsd:dateTime` strings like `+1970-01-15T00:00:00Z`
 * (a leading `+` is legal for the proleptic Gregorian calendar). But a P569 can
 * also be a "some value" / "no value" snak, which SPARQL surfaces as a blank-node
 * URI (`http://www.wikidata.org/.well-known/genid/…`) — NOT a date. Writing that
 * URI into a `date` column throws `invalid input syntax for type date`. So accept
 * ONLY a value whose first 10 chars (after an optional `+`) match `yyyy-mm-dd`.
 */
export function parseWikidataDate(value: string | undefined): string | null {
  if (!value) return null;
  const iso = value.replace(/^\+/, "").split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** Resolve a Commons `Special:FilePath/<file>` URL to the bare file name. */
export function commonsFileFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(/Special:FilePath\/(.+?)(\?|$)/);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return m[1];
  }
}

function stripHtml(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Is a Commons `LicenseShortName` genuinely FREE (redistributable, at most
 * with attribution)? PD, any CC variant (incl. CC0), and recognised
 * open-government licences count. Anything non-commercial-only, fair-use,
 * all-rights-reserved, or unreadable is treated as NOT free → skipped.
 */
export function commonsLicenseIsFree(lic: string): boolean {
  const l = lic.toLowerCase();
  if (!l || l === "unknown") return false;
  if (
    /non-commercial|noncommercial|\bnc\b|fair use|all rights reserved|non-free|nonfree/.test(
      l,
    )
  ) {
    return false;
  }
  return /cc0|cc[ -]by|public domain|\bpd\b|pdm|gfdl|godl|ogl|open government|europ|attribution|dl-de|etalab|kogl/.test(
    l,
  );
}

export interface CommonsFileMeta {
  license: string;
  credit: string;
}

/**
 * Fetch per-file license + author from the Commons `imageinfo` API, exactly as
 * `sync-country-galleries.ts` does. Read-only network call; no download. Titles
 * are batched (50/request) with a small politeness sleep between batches.
 */
export async function fetchCommonsFileMeta(
  files: string[],
  batchSize = 50,
): Promise<Map<string, CommonsFileMeta>> {
  const out = new Map<string, CommonsFileMeta>();
  for (const batch of chunk(files, batchSize)) {
    const titles = batch.map((f) => `File:${f}`).join("|");
    const url = new URL(COMMONS_ENDPOINT);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "extmetadata");
    url.searchParams.set("titles", titles);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": COMMONS_USER_AGENT },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title: string;
              imageinfo?: Array<{
                extmetadata?: Record<string, { value?: string }>;
              }>;
            }
          >;
        };
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const file = page.title.replace(/^File:/, "");
        const ex = page.imageinfo?.[0]?.extmetadata;
        const license = stripHtml(ex?.LicenseShortName?.value) || "unknown";
        const author = stripHtml(ex?.Artist?.value);
        const credit = stripHtml(ex?.Credit?.value);
        out.set(file, {
          license,
          credit: author || credit || "Wikimedia Commons",
        });
      }
    } catch {
      // Network hiccup on a batch → those files simply have no meta and are
      // conservatively skipped (unknown license). Never fabricate a license.
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}

// ─── Reusable person-portrait enrichment pass ───────────────────────────────

const SPARQL_BATCH = 150; // QIDs per SPARQL VALUES batch
const SPARQL_SLEEP_MS = 600; // politeness between SPARQL batches
const COMMONS_BATCH = 50; // titles per Commons imageinfo request

export interface PersonPortraitCandidate {
  personId: string;
  personName: string;
  personQid: string;
}

/** A person that gained a free portrait (or already had this exact file). */
export interface ProposedPersonPortrait {
  personId: string;
  personName: string;
  personQid: string;
  /** Commons file name (bare, no "File:" prefix) — rendered via wikimediaUrl. */
  file: string;
  license: string;
  credit: string;
}

/** A person that gained a birthdate. */
export interface ProposedPersonBirthdate {
  personId: string;
  personName: string;
  personQid: string;
  dob: string; // ISO yyyy-mm-dd
}

/** A P18 image found but NOT proposed (non-free / unreadable license). */
export interface SkippedPersonPortrait {
  personId: string;
  personName: string;
  file: string;
  license: string;
}

export interface PersonPortraitPlan {
  portraits: ProposedPersonPortrait[];
  birthdates: ProposedPersonBirthdate[];
  skippedPortraits: SkippedPersonPortrait[];
  noImage: PersonPortraitCandidate[];
  stats: {
    candidates: number;
    portraitFound: number;
    portraitFree: number;
    portraitSkippedNonFree: number;
    portraitNoImage: number;
    dobFound: number;
  };
}

/**
 * Load every `persons` row eligible for a portrait/birthdate backfill:
 * `wikidata_qid IS NOT NULL AND (photo_url IS NULL OR date_of_birth IS NULL)`.
 *
 * Both media fields are independent — a person can already have a portrait but
 * still be missing a birthdate (e.g. an earlier run's DOB write was dropped), so
 * candidacy is "missing EITHER field", not just "missing photo". The per-field
 * write guards (`isNull(photo_url)` / `isNull(date_of_birth)`) mean an existing
 * value is never overwritten, so this stays idempotent: a person drops out of
 * the candidate set only once they have BOTH a photo and a birthdate (or the
 * pass has confirmed Wikidata offers no free portrait / no P569 for them).
 * `limit` caps the candidate set for smoke tests.
 */
export async function loadPortraitCandidates(
  db: PersonPortraitsDb = sharedDb,
  limit?: number,
): Promise<PersonPortraitCandidate[]> {
  const q = db
    .select({ id: persons.id, name: persons.name, qid: persons.wikidataQid })
    .from(persons)
    .where(
      and(
        isNotNull(persons.wikidataQid),
        or(isNull(persons.photoUrl), isNull(persons.dateOfBirth)),
      ),
    )
    // Deterministic order so a --limit smoke test is stable and reproducible.
    .orderBy(persons.name, persons.id);
  const rows = limit && limit > 0 ? await q.limit(limit) : await q;
  return rows
    .filter((r): r is { id: string; name: string; qid: string } => Boolean(r.qid))
    .map((r) => ({ personId: r.id, personName: r.name, personQid: r.qid }));
}

/**
 * Compute the proposed portrait + birthdate change set for a set of person
 * candidates. Pure read — hits Wikidata (SPARQL) for P18/P569, then Commons
 * (imageinfo) for the per-file license/author. Writes NOTHING.
 *
 * A person appears in exactly one of `portraits` (free image) /
 * `skippedPortraits` (non-free image) / `noImage` (no P18), and independently
 * in `birthdates` when a P569 exists.
 */
export async function computePersonPortraitPlan(
  candidates: PersonPortraitCandidate[],
  log: (line: string) => void = () => {},
): Promise<PersonPortraitPlan> {
  const plan: PersonPortraitPlan = {
    portraits: [],
    birthdates: [],
    skippedPortraits: [],
    noImage: [],
    stats: {
      candidates: candidates.length,
      portraitFound: 0,
      portraitFree: 0,
      portraitSkippedNonFree: 0,
      portraitNoImage: 0,
      dobFound: 0,
    },
  };
  if (candidates.length === 0) return plan;

  // De-dup by QID for the SPARQL/Commons fetch (two persons rarely share a QID,
  // but the backfill guarantees nothing). We still key results back per person.
  const qids = [...new Set(candidates.map((c) => c.personQid))];
  log(
    `Portrait enrichment: ${candidates.length} candidate persons, ${qids.length} distinct Q-IDs`,
  );

  // 1. P18 image (Commons file) + P569 birthdate per person QID.
  const imageFileByQid = new Map<string, string>();
  const dobByQid = new Map<string, string>();
  let batchNo = 0;
  const totalBatches = Math.ceil(qids.length / SPARQL_BATCH);
  for (const batch of chunk(qids, SPARQL_BATCH)) {
    batchNo++;
    const bindings = await sparqlQuery(mediaQuery(batch));
    for (const b of bindings) {
      const person = extractQid(b.person.value);
      if (b.image?.value) {
        const file = commonsFileFromUrl(b.image.value);
        if (file && !imageFileByQid.has(person)) imageFileByQid.set(person, file);
      }
      if (!dobByQid.has(person)) {
        const dob = parseWikidataDate(b.dob?.value);
        if (dob) dobByQid.set(person, dob);
      }
    }
    log(
      `  SPARQL batch ${batchNo}/${totalBatches}: ${imageFileByQid.size} portraits, ${dobByQid.size} birthdates so far`,
    );
    await new Promise((r) => setTimeout(r, SPARQL_SLEEP_MS));
  }

  // 2. Commons per-file license + author for the distinct image files.
  const distinctFiles = [...new Set(imageFileByQid.values())];
  log(`  fetching Commons license for ${distinctFiles.length} distinct files`);
  const fileMeta = await fetchCommonsFileMeta(distinctFiles, COMMONS_BATCH);

  // 3. Assemble per-person proposals.
  for (const c of candidates) {
    const dob = dobByQid.get(c.personQid);
    if (dob) {
      plan.stats.dobFound++;
      plan.birthdates.push({
        personId: c.personId,
        personName: c.personName,
        personQid: c.personQid,
        dob,
      });
    }

    const file = imageFileByQid.get(c.personQid);
    if (!file) {
      plan.stats.portraitNoImage++;
      plan.noImage.push(c);
      continue;
    }
    plan.stats.portraitFound++;
    const meta = fileMeta.get(file);
    const license = meta?.license ?? "unknown";
    if (commonsLicenseIsFree(license)) {
      plan.stats.portraitFree++;
      plan.portraits.push({
        personId: c.personId,
        personName: c.personName,
        personQid: c.personQid,
        file,
        license,
        credit: meta?.credit ?? "Wikimedia Commons",
      });
    } else {
      plan.stats.portraitSkippedNonFree++;
      plan.skippedPortraits.push({
        personId: c.personId,
        personName: c.personName,
        file,
        license,
      });
    }
  }

  return plan;
}

export interface EnrichPersonPortraitsOptions {
  db?: PersonPortraitsDb;
  /** Cap the candidate set (smoke tests). Omit for the full backfill. */
  limit?: number;
  /** Compute + report the plan but write NOTHING and never stamp freshness. */
  dryRun?: boolean;
  /** Progress sink. Lines starting with `!` are warnings. */
  onProgress?: (line: string) => void;
  /** Fixture/aggregate seam. Defaults to the sanctioned immediate helper. */
  markSynced?: typeof markSourcesSynced;
  /** Bounded fixture seam. Production loads candidates from the database. */
  loadCandidates?: typeof loadPortraitCandidates;
  /** Bounded fixture seam. Production computes the live Wikidata plan. */
  computePlan?: typeof computePersonPortraitPlan;
}

export interface EnrichPersonPortraitsSummary {
  /** Partial means at least one planned row failed to write. */
  status: "completed" | "partial";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  candidates: number;
  portraitsWritten: number;
  birthdatesWritten: number;
  writeFailures: number;
  portraitsSkippedNonFree: number;
  portraitsNoImage: number;
  dryRun: boolean;
  freshnessStamped: boolean;
  plan: PersonPortraitPlan;
}

/**
 * Full reusable pass: load candidates → compute the plan → (apply) → stamp
 * freshness. On apply, writes ONLY persons that gained a value and NEVER
 * overwrites an existing photo_url (the candidate query already excludes rows
 * with a photo_url, so this is guaranteed). Idempotent across runs.
 *
 * Stamps `sources.last_sync_at` for `wikidata` via `markSourcesSynced` — only
 * on a real apply that actually wrote rows.
 */
export async function enrichPersonPortraits(
  options: EnrichPersonPortraitsOptions = {},
): Promise<EnrichPersonPortraitsSummary> {
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const dryRun = options.dryRun ?? false;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const candidates = await (options.loadCandidates ?? loadPortraitCandidates)(
    db,
    options.limit,
  );
  log(
    `Loaded ${candidates.length} candidate persons (wikidata_qid set, photo_url null)` +
      (options.limit ? ` [--limit=${options.limit}]` : ""),
  );

  const plan = await (options.computePlan ?? computePersonPortraitPlan)(
    candidates,
    log,
  );

  let portraitsWritten = 0;
  let birthdatesWritten = 0;
  let writeFailures = 0;

  if (!dryRun) {
    // Portraits: bare Commons file name + per-file credit. The candidate query
    // guarantees photo_url IS NULL, so this only ever FILLS, never overwrites.
    // Per-row try/catch retains the complete failure count for the aggregate.
    // Any failed planned write makes the pass partial and withholds freshness.
    for (const p of plan.portraits) {
      try {
        const res = await db
          .update(persons)
          .set({ photoUrl: p.file, photoLicense: p.license, photoCredit: p.credit })
          .where(and(eq(persons.id, p.personId), isNull(persons.photoUrl)));
        // Count only a row that actually changed — a candidate re-seen because
        // it was missing a DOB (not a photo) no-ops here and must not inflate.
        const rowCount = (res as unknown as { rowCount?: number }).rowCount;
        if (rowCount === undefined || rowCount > 0) portraitsWritten++;
      } catch (err) {
        writeFailures++;
        log(
          `! portrait write failed for ${p.personName} (${p.personQid}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // Birthdates: only fill when currently null (never clobber a curated DOB).
    for (const b of plan.birthdates) {
      try {
        const res = await db
          .update(persons)
          .set({ dateOfBirth: b.dob })
          .where(and(eq(persons.id, b.personId), isNull(persons.dateOfBirth)));
        // neon-http returns { rowCount }; count only a row that actually changed.
        const rowCount = (res as unknown as { rowCount?: number }).rowCount;
        if (rowCount === undefined || rowCount > 0) birthdatesWritten++;
      } catch (err) {
        writeFailures++;
        log(
          `! birthdate write failed for ${b.personName} (${b.personQid}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  const totalRowsWritten = portraitsWritten + birthdatesWritten;
  const stamped = dryRun || writeFailures > 0
    ? []
    : await (options.markSynced ?? markSourcesSynced)("wikidata", {
        rowsWritten: totalRowsWritten,
        executor: db,
      });

  const finishedAtMs = Date.now();
  return {
    status: writeFailures > 0 ? "partial" : "completed",
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    candidates: candidates.length,
    portraitsWritten,
    birthdatesWritten,
    writeFailures,
    portraitsSkippedNonFree: plan.stats.portraitSkippedNonFree,
    portraitsNoImage: plan.stats.portraitNoImage,
    dryRun,
    freshnessStamped: stamped.length > 0,
    plan,
  };
}

/** Pretty-print a person-portrait plan (dry-run report / apply summary). */
export function reportPersonPortraitPlan(
  plan: PersonPortraitPlan,
  log: (line: string) => void = (line) => console.log(line),
): void {
  const s = plan.stats;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  log("\n========================================================");
  log("  Person-portrait enrichment plan (P18 + P569)");
  log("========================================================\n");
  log(`  Candidate persons (qid set, no photo): ${s.candidates}`);
  log(
    `  → have a P18 portrait on Wikidata:     ${s.portraitFound} (${pct(
      s.portraitFound,
      s.candidates,
    )}%)`,
  );
  log(
    `     · with a FREE Commons license:      ${s.portraitFree} (would render as a portrait)`,
  );
  log(
    `     · non-free / unreadable license:    ${s.portraitSkippedNonFree} (SKIPPED — stays monogram)`,
  );
  log(`  → NO P18 image (stays monogram):       ${s.portraitNoImage}`);
  log(
    `  → have a P569 birthdate:               ${s.dobFound} (${pct(
      s.dobFound,
      s.candidates,
    )}%)`,
  );

  const sample = <T,>(arr: T[], n: number): T[] => arr.slice(0, n);

  log("\nPORTRAIT SAMPLE (person · Commons file · license · credit)");
  for (const p of sample(plan.portraits, 20)) {
    log(`  ${p.personName}`);
    log(`      file:    ${p.file}`);
    log(`      license: ${p.license}   credit: ${p.credit}`);
  }

  log("\nBIRTHDATE SAMPLE (person · P569)");
  for (const b of sample(plan.birthdates, 15)) {
    log(`  ${b.personName} · ${b.dob}`);
  }

  if (plan.skippedPortraits.length > 0) {
    log(
      `\nSKIPPED PORTRAITS (non-free / unreadable license → stays monogram): ${plan.skippedPortraits.length}`,
    );
    for (const p of sample(plan.skippedPortraits, 12)) {
      log(`  ${p.license} — ${p.personName} — ${p.file}`);
    }
  }

  log(
    "\nSchema note: portraits store the Commons FILE NAME in persons.photo_url",
  );
  log(
    "  (rendered via wikimediaUrl, hotlink-the-CDN — no local files); birthdate →",
  );
  log(
    "  persons.date_of_birth; per-file credit → persons.photo_license + persons.photo_credit.",
  );
  log('  On APPLY, provenance is stamped via markSourcesSynced("wikidata").\n');
}
