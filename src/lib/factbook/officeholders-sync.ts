/**
 * Wikidata officeholder sync — orchestration (library form).
 *
 * This module wraps the full head-of-state / head-of-government spine sync
 * PLUS the P39 title + P102/colour party enrichment so it can be invoked
 * from BOTH:
 *   - the imperative CLI script (`scripts/sync-wikidata-officeholders.ts`),
 *     which keeps its `--dry-run` preview path, and
 *   - the Vercel cron route (`/api/cron/factbook/sync-officeholders`).
 *
 * Design mirrors `reconcile/wikidata-sync.ts`: keep it pure-ish — take a `db`
 * instance (defaulting to the shared client) and an `onProgress` log sink,
 * return a summary, never read CLI args or call `process.exit()`.
 *
 * The matching / scoring logic is UNCHANGED from the original CLI script — it
 * was only relocated so there is a single implementation. On a real apply the
 * run stamps `sources.last_sync_at` via `markSourcesSynced("wikidata", …)` —
 * the one sanctioned path — and only when rows were actually written.
 */
import { eq, sql, ilike } from "drizzle-orm";

import { db as sharedDb } from "@/lib/db";
import {
  jurisdictions,
  governmentBodies,
  offices,
  persons,
  terms,
  statements,
  legislatureParties,
} from "@/lib/db/schema";
import { sparqlQuery, extractQid } from "@/lib/data/wikidata";
import { markSourcesSynced } from "@/lib/db/source-freshness";

/**
 * Anything that can run the Drizzle queries below — the shared `db` client or
 * a compatible instance. The default is the shared client so the route omits
 * it and the CLI can pass its own.
 */
export type OfficeholderSyncDb = typeof sharedDb;

export interface OfficeholderSyncOptions {
  /** Drizzle client to run against. Defaults to the shared `@/lib/db` client. */
  db?: OfficeholderSyncDb;
  /** Progress sink. Lines starting with `!` are warnings. Defaults to no-op. */
  onProgress?: (line: string) => void;
}

export interface OfficeholderSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** Countries whose leadership spine was upserted. */
  countriesSynced: number;
  /** Countries seen in Wikidata but not matched to a jurisdiction. */
  countriesSkipped: number;
  /** Unresolved `Q…`-as-name persons that were resolved to real labels. */
  qidNamesResolved: number;
  /** Real office titles (P39) written over generic names. */
  titlesWritten: number;
  /** Current terms that gained a party (P102) affiliation. */
  partiesWritten: number;
  /** Total rows written (base + titles + parties) — drives the freshness stamp. */
  totalRowsWritten: number;
  /** Whether `sources.last_sync_at` was stamped this run. */
  freshnessStamped: boolean;
}

// Generic office names we are allowed to overwrite with a real P39 title. A
// hand-curated US/UK title (e.g. "Chancellor of the Exchequer") is never one
// of these, so it is never clobbered.
const GENERIC_OFFICE_NAMES = new Set(["Head of State", "Head of Government"]);

const QUERY = `
SELECT ?state ?stateLabel ?iso2 ?iso3 ?shortName
       ?headOfState ?headOfStateLabel ?hosStart
       ?headOfGov ?headOfGovLabel ?hogStart
WHERE {
  ?state wdt:P31 wd:Q3624078 .
  OPTIONAL { ?state wdt:P297 ?iso2 . }
  OPTIONAL { ?state wdt:P298 ?iso3 . }
  OPTIONAL { ?state wdt:P1813 ?shortName . FILTER(LANG(?shortName) = "en") }
  OPTIONAL {
    ?state p:P35 ?hosStatement .
    ?hosStatement ps:P35 ?headOfState .
    OPTIONAL { ?hosStatement pq:P580 ?hosStart . }
    FILTER NOT EXISTS { ?hosStatement pq:P582 ?hosEnd . }
  }
  OPTIONAL {
    ?state p:P6 ?hogStatement .
    ?hogStatement ps:P6 ?headOfGov .
    OPTIONAL { ?hogStatement pq:P580 ?hogStart . }
    FILTER NOT EXISTS { ?hogStatement pq:P582 ?hogEnd . }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;

const WIKIDATA_TO_SLUG: Record<string, string> = {
  "People's Republic of China": "china",
  "Democratic Republic of the Congo": "drc",
  "Republic of the Congo": "congo-brazzaville",
  "Myanmar": "burma",
  "Kingdom of the Netherlands": "netherlands",
  "Dominican Republic": "the-dominican",
  "State of Israel": "israel",
  "Kingdom of Denmark": "denmark",
  "Republic of Cabo Verde": "cabo-verde",
  "Czech Republic": "czechia",
  "Republic of Côte d'Ivoire": "c-te-d-ivoire",
  "Ivory Coast": "c-te-d-ivoire",
  "Côte d'Ivoire": "c-te-d-ivoire",
  "Türkiye": "turkiye",
  "Republic of Türkiye": "turkiye",
  "Eswatini": "eswatini",
  "Kingdom of Eswatini": "eswatini",
  "São Tomé and Príncipe": "sao-tome-and-principe",
  "Timor-Leste": "timor-leste",
  "Cape Verde": "cabo-verde",
  "Vatican City": "holy-see-vatican-city",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function findJurisdiction(
  db: OfficeholderSyncDb,
  iso2: string | null,
  qid: string,
  name: string,
  shortName: string | null
) {
  if (iso2) {
    const byIso = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.iso2, iso2.toUpperCase()))
      .limit(1);
    if (byIso.length > 0) return byIso[0].id;
  }

  const byQid = await db
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.wikidataQid, qid))
    .limit(1);
  if (byQid.length > 0) return byQid[0].id;

  const aliasSlug = WIKIDATA_TO_SLUG[name];
  if (aliasSlug) {
    const byAlias = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.slug, aliasSlug))
      .limit(1);
    if (byAlias.length > 0) return byAlias[0].id;
  }

  const slug = slugify(name);
  if (slug) {
    const bySlug = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.slug, slug))
      .limit(1);
    if (bySlug.length > 0) return bySlug[0].id;
  }

  if (shortName) {
    const shortSlug = slugify(shortName);
    if (shortSlug && shortSlug !== slug) {
      const byShortSlug = await db
        .select({ id: jurisdictions.id })
        .from(jurisdictions)
        .where(eq(jurisdictions.slug, shortSlug))
        .limit(1);
      if (byShortSlug.length > 0) return byShortSlug[0].id;
    }

    const byShortName = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(ilike(jurisdictions.name, shortName))
      .limit(1);
    if (byShortName.length > 0) return byShortName[0].id;
  }

  if (name) {
    const byName = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(ilike(jurisdictions.name, name))
      .limit(1);
    if (byName.length > 0) return byName[0].id;
  }

  // Substring match: check if DB name is contained in the Wikidata name
  if (name) {
    const byContains = await db
      .select({ id: jurisdictions.id, name: jurisdictions.name })
      .from(jurisdictions)
      .where(
        sql`${jurisdictions.type} = 'sovereign_state' AND LOWER(${name}) LIKE '%' || LOWER(${jurisdictions.name}) || '%'`
      )
      .limit(1);
    if (byContains.length > 0) return byContains[0].id;
  }

  return null;
}

const LABEL_LANG_PRIORITY = ["en", "mul", "la", "fr", "es", "de", "pt"];

async function resolveQidLabel(qid: string): Promise<string | null> {
  try {
    const langs = LABEL_LANG_PRIORITY.join("|");
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=${langs}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Civica/1.0 (https://civicaatlas.org)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const labels = data.entities?.[qid]?.labels ?? {};
    for (const lang of LABEL_LANG_PRIORITY) {
      if (labels[lang]?.value) return labels[lang].value;
    }
  } catch {}
  return null;
}

async function upsertPerson(
  db: OfficeholderSyncDb,
  name: string,
  qid: string
): Promise<string> {
  const existing = await db
    .select({ id: persons.id, name: persons.name })
    .from(persons)
    .where(eq(persons.wikidataQid, qid))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].name !== name && !name.match(/^Q\d+$/)) {
      await db.update(persons).set({ name }).where(eq(persons.id, existing[0].id));
    }
    return existing[0].id;
  }

  const inserted = await db
    .insert(persons)
    .values({ name, wikidataQid: qid })
    .returning({ id: persons.id });
  return inserted[0].id;
}

async function upsertBody(
  db: OfficeholderSyncDb,
  jurisdictionId: string,
  name: string,
  branch: string
): Promise<string> {
  const existing = await db
    .select({ id: governmentBodies.id })
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId} AND ${governmentBodies.branch} = ${branch}`
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(governmentBodies)
    .values({
      jurisdictionId,
      name,
      bodyType: branch === "executive" ? "cabinet" : "parliament",
      branch,
      hierarchyLevel: 0,
    })
    .returning({ id: governmentBodies.id });
  return inserted[0].id;
}

async function upsertOffice(
  db: OfficeholderSyncDb,
  bodyId: string,
  name: string,
  officeType: string,
  qid?: string
): Promise<string> {
  const existing = await db
    .select({ id: offices.id })
    .from(offices)
    .where(
      sql`${offices.bodyId} = ${bodyId} AND ${offices.officeType} = ${officeType}`
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(offices)
    .values({
      bodyId,
      name,
      officeType,
      isElected: true,
      wikidataQid: qid,
    })
    .returning({ id: offices.id });
  return inserted[0].id;
}

async function upsertTerm(
  db: OfficeholderSyncDb,
  officeId: string,
  personId: string,
  startDate: string | null
) {
  // 1. If a term already exists for this (officeId, personId, startDate),
  //    just make sure it's marked current. Without this guard, every sync
  //    run was inserting a fresh duplicate row — that's how Nigeria ended
  //    up with 16 Tinubu rows (8 sync runs × 2 offices). See
  //    .claude/rules/memory-decisions.md for the data-cleanup note.
  const existing = await db
    .select({ id: terms.id, isCurrent: terms.isCurrent })
    .from(terms)
    .where(
      sql`${terms.officeId} = ${officeId} AND ${terms.personId} = ${personId} AND ${terms.startDate} IS NOT DISTINCT FROM ${startDate}`
    )
    .limit(1);

  // 2. Mark every other term on this office as not current — the new one
  //    (or the existing match) is the only current incumbent.
  if (existing.length > 0) {
    await db
      .update(terms)
      .set({ isCurrent: false })
      .where(
        sql`${terms.officeId} = ${officeId} AND ${terms.id} <> ${existing[0].id} AND ${terms.isCurrent} = true`
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
    .where(
      sql`${terms.officeId} = ${officeId} AND ${terms.isCurrent} = true`
    );

  await db.insert(terms).values({
    officeId,
    personId,
    startDate,
    isCurrent: true,
  });
}

async function upsertStatement(
  db: OfficeholderSyncDb,
  personId: string,
  predicate: string,
  objectValue: string,
  stateQid: string
) {
  // Same pattern as upsertTerm — without this guard the statements table
  // accumulated 8× duplicates per officeholder across sync runs.
  const existing = await db
    .select({ id: statements.id })
    .from(statements)
    .where(
      sql`${statements.subjectTable} = ${"terms"} AND ${statements.subjectId} = ${personId} AND ${statements.predicate} = ${predicate}`
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(statements)
      .set({
        objectValue,
        sourceId: "wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${stateQid}`,
        sourceLicense: "CC0",
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
    sourceId: "wikidata",
    sourceUrl: `https://www.wikidata.org/wiki/${stateQid}`,
    sourceLicense: "CC0",
    retrievedAt: new Date(),
  });
}

// ─── P1 + P3 enrichment: real office titles (P39) and party (P102) ──────────
//
// Keyed on the person Q-IDs already stored on `persons`, this pass fetches:
//   - the person's current "position held" (P39) statements and picks the one
//     that is the head-of-state / head-of-government office FOR THAT COUNTRY,
//     using the position label → `offices.name` (replacing the generic string);
//   - the person's current "member of political party" (P102) → `terms.partyName`,
//     plus the party color (P462→P465) → `terms.partyColor`, with a fallback to
//     a matching `legislature_parties` color by exact (country, name) match.
//
// Honest-data posture: when no plausible head-title P39 resolves we KEEP the
// generic office name (never invent a title); when no party resolves we leave
// it null. Nothing is fabricated.

const Q_HEAD_OF_STATE = "Q48352";
const Q_HEAD_OF_GOVERNMENT = "Q2285706";

interface PositionMeta {
  label: string;
  juris: string | null; // P1001 applies-to-jurisdiction
  of: string | null; // P642 "of"
  country: string | null; // P17 country
  isHoS: boolean; // P279* head of state
  isHoG: boolean; // P279* head of government
}

interface PartyInfo {
  name: string;
  color: string | null;
}

/** A generic "Head of State of X" label — real but less specific; deprioritise. */
function isGenericPositionLabel(label: string): boolean {
  return /^head of (state|government)\b/i.test(label.trim());
}

// Label patterns for genuine head-of-state / head-of-government offices. The
// P279* role-class check is incomplete on Wikidata (e.g. "Prime Minister of
// India" is not modelled as a head-of-government subclass), so we also accept
// a head-title label. Conversely, a jurisdiction-matched but non-head P39
// (e.g. "member of the Grand and General Council") must NOT become the office
// title — this gate blocks that.
const HEAD_TITLE_RE =
  /\b(president|prime minister|premier|chancellor|king|queen|monarch|emir|amir|sultan|emperor|empress|pope|supreme leader|captain regent|governor[- ]general|chair(man|person|woman)? of the (presidency|council of ministers|state council|sovereignty council|presidential council)|co[- ]?prince|grand duke|grand duchess|sovereign prince|prince of|head of (state|government)|chief executive|state counsellor|paramount|yang di-?pertuan)\b/i;

function looksLikeHeadTitle(label: string): boolean {
  return HEAD_TITLE_RE.test(label);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Current (P582-absent) P39 positions per person. */
function personPositionsQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  return `
SELECT ?person ?position WHERE {
  VALUES ?person { ${values} }
  ?person p:P39 ?st .
  ?st ps:P39 ?position .
  FILTER NOT EXISTS { ?st pq:P582 ?end . }
}
`;
}

/** Metadata + HoS/HoG class for a batch of position items. */
function positionMetaQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  return `
SELECT ?position ?positionLabel ?juris ?of ?country ?isHoS ?isHoG WHERE {
  VALUES ?position { ${values} }
  OPTIONAL { ?position wdt:P1001 ?juris . }
  OPTIONAL { ?position wdt:P642 ?of . }
  OPTIONAL { ?position wdt:P17 ?country . }
  BIND(EXISTS { ?position wdt:P279* wd:${Q_HEAD_OF_STATE} } AS ?isHoS)
  BIND(EXISTS { ?position wdt:P279* wd:${Q_HEAD_OF_GOVERNMENT} } AS ?isHoG)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
}

/** Current (P582-absent) party membership + party color per person. */
function partyQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  return `
SELECT ?person ?party ?partyLabel ?color WHERE {
  VALUES ?person { ${values} }
  ?person p:P102 ?st .
  ?st ps:P102 ?party .
  FILTER NOT EXISTS { ?st pq:P582 ?end . }
  OPTIONAL { ?party wdt:P462 ?ce . ?ce wdt:P465 ?color . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
}

interface EnrichmentRow {
  jurisdictionId: string;
  country: string;
  countryQid: string | null;
  officeId: string;
  officeType: "head_of_state" | "head_of_government";
  officeName: string;
  personId: string;
  personName: string;
  personQid: string | null;
  termId: string | null;
  hasParty: boolean;
}

interface ProposedTitle {
  country: string;
  role: string;
  officeId: string;
  oldName: string;
  newName: string;
  positionQid: string;
}

interface ProposedParty {
  country: string;
  person: string;
  role: string;
  termId: string | null;
  party: string;
  color: string | null;
  colorSource: "wikidata" | "legislature_parties" | "none";
}

export interface EnrichmentPlan {
  titles: ProposedTitle[];
  parties: ProposedParty[];
  stayGeneric: { country: string; role: string; person: string; qid: string | null }[];
  stats: {
    spineRows: number;
    titleResolved: number;
    titleStaysGeneric: number;
    partylessConsidered: number;
    partyResolved: number;
    colorFromWikidata: number;
    colorFromLegislature: number;
    colorMissing: number;
  };
}

/**
 * Compute the full proposed title + party change set from Wikidata, keyed on
 * the person Q-IDs already stored. Pure read — fetches from Wikidata + reads
 * the legislature_parties color dictionary; writes NOTHING.
 */
export async function computeEnrichmentPlan(
  db: OfficeholderSyncDb = sharedDb,
  log: (line: string) => void = () => {}
): Promise<EnrichmentPlan> {
  // Spine: every current term on a generic-named head_of_state/head_of_government
  // office, with the person Q-ID and the country Q-ID.
  const spineRows = (await db.execute(sql`
    SELECT j.id AS jurisdiction_id, j.name AS country, j.wikidata_qid AS country_qid,
           o.id AS office_id, o.office_type, o.name AS office_name,
           p.id AS person_id, p.name AS person_name, p.wikidata_qid AS person_qid,
           t.id AS term_id, (t.party_name IS NOT NULL) AS has_party
    FROM terms t
    JOIN offices o ON t.office_id = o.id
    JOIN government_bodies gb ON o.body_id = gb.id
    JOIN jurisdictions j ON gb.jurisdiction_id = j.id
    JOIN persons p ON t.person_id = p.id
    WHERE t.is_current = true
      AND o.office_type IN ('head_of_state','head_of_government')
      AND o.name IN ('Head of State','Head of Government')
    ORDER BY j.name, o.office_type
  `)) as unknown as {
    rows?: Record<string, unknown>[];
  };
  const rawRows = (spineRows.rows ?? (spineRows as unknown as Record<string, unknown>[])) as Record<string, unknown>[];
  const spine: EnrichmentRow[] = rawRows.map((r) => ({
    jurisdictionId: String(r.jurisdiction_id),
    country: String(r.country),
    countryQid: r.country_qid ? String(r.country_qid) : null,
    officeId: String(r.office_id),
    officeType: String(r.office_type) as "head_of_state" | "head_of_government",
    officeName: String(r.office_name),
    personId: String(r.person_id),
    personName: String(r.person_name),
    personQid: r.person_qid ? String(r.person_qid) : null,
    termId: r.term_id ? String(r.term_id) : null,
    hasParty: r.has_party === true || r.has_party === "true",
  }));

  const personQids = [
    ...new Set(spine.map((r) => r.personQid).filter((q): q is string => Boolean(q))),
  ];
  log(
    `Enrichment spine: ${spine.length} generic offices, ${personQids.length} distinct person Q-IDs`
  );

  // 1. Current P39 positions per person.
  const personPositions = new Map<string, string[]>();
  for (const batch of chunk(personQids, 50)) {
    const bindings = await sparqlQuery(personPositionsQuery(batch));
    for (const b of bindings) {
      const person = extractQid(b.person.value);
      const position = extractQid(b.position.value);
      const arr = personPositions.get(person) ?? [];
      arr.push(position);
      personPositions.set(person, arr);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const allPositions = [...new Set([...personPositions.values()].flat())];
  log(`  fetched ${allPositions.length} distinct candidate positions`);

  // 2. Position metadata + role class.
  const posMeta = new Map<string, PositionMeta>();
  for (const batch of chunk(allPositions, 60)) {
    const bindings = await sparqlQuery(positionMetaQuery(batch));
    for (const b of bindings) {
      const position = extractQid(b.position.value);
      const meta: PositionMeta =
        posMeta.get(position) ?? {
          label: b.positionLabel?.value ?? position,
          juris: null,
          of: null,
          country: null,
          isHoS: false,
          isHoG: false,
        };
      if (b.juris && !meta.juris) meta.juris = extractQid(b.juris.value);
      if (b.of && !meta.of) meta.of = extractQid(b.of.value);
      if (b.country && !meta.country) meta.country = extractQid(b.country.value);
      meta.isHoS = meta.isHoS || b.isHoS?.value === "true";
      meta.isHoG = meta.isHoG || b.isHoG?.value === "true";
      posMeta.set(position, meta);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  // 3. Party + color per person.
  const partyByPerson = new Map<string, PartyInfo>();
  for (const batch of chunk(personQids, 50)) {
    const bindings = await sparqlQuery(partyQuery(batch));
    for (const b of bindings) {
      const person = extractQid(b.person.value);
      const name = b.partyLabel?.value ?? extractQid(b.party.value);
      if (/^Q\d+$/.test(name)) continue;
      const color = b.color?.value ? `#${b.color.value}` : null;
      const existing = partyByPerson.get(person);
      // Prefer a value that carries a color; otherwise first seen wins.
      if (!existing || (!existing.color && color)) {
        partyByPerson.set(person, { name, color });
      }
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  // 4. legislature_parties color dictionary, keyed (jurisdictionId, lower(name)).
  //    Exact-name match only — fuzzy matching risks assigning the wrong colour,
  //    which would violate the honest-data posture.
  const legColorRows = await db
    .select({
      jurisdictionId: governmentBodies.jurisdictionId,
      partyName: legislatureParties.partyName,
      partyColor: legislatureParties.partyColor,
    })
    .from(legislatureParties)
    .innerJoin(
      governmentBodies,
      eq(legislatureParties.bodyId, governmentBodies.id)
    )
    .where(sql`${legislatureParties.partyColor} IS NOT NULL`);
  const legColor = new Map<string, string>();
  for (const r of legColorRows) {
    if (r.partyColor) {
      legColor.set(`${r.jurisdictionId}|${r.partyName.toLowerCase()}`, r.partyColor);
    }
  }

  // ── Title selection ────────────────────────────────────────────────────────
  function chooseTitle(row: EnrichmentRow): { title: string; positionQid: string } | null {
    if (!row.personQid) return null;
    const positions = personPositions.get(row.personQid) ?? [];
    const wantHoS = row.officeType === "head_of_state";
    type Cand = { position: string; meta: PositionMeta; score: number };
    const cands: Cand[] = [];
    for (const position of positions) {
      const meta = posMeta.get(position);
      if (!meta) continue;
      const roleClassMatch = wantHoS ? meta.isHoS : meta.isHoG;
      const roleClassAny = meta.isHoS || meta.isHoG;
      const headTitle = looksLikeHeadTitle(meta.label);
      const jurisMatch =
        (!!row.countryQid && meta.juris === row.countryQid) ||
        (!!row.countryQid && meta.of === row.countryQid) ||
        (!!row.countryQid && meta.country === row.countryQid);
      const headLike = roleClassMatch || headTitle;
      let score = 0;
      if (jurisMatch) score += 10;
      if (roleClassMatch) score += 5;
      if (headTitle) score += 3;
      else if (roleClassAny && !roleClassMatch) score -= 8; // wrong role-class
      if (!isGenericPositionLabel(meta.label)) score += 2;
      // Gate: must read as a head office AND either match this country's
      // jurisdiction, or be a bare country-agnostic head title.
      const eligible =
        headLike &&
        (jurisMatch || (!meta.juris && !meta.of && !meta.country));
      if (eligible) cands.push({ position, meta, score });
    }
    if (cands.length === 0) return null;
    cands.sort(
      (a, b) => b.score - a.score || a.meta.label.length - b.meta.label.length
    );
    const best = cands[0];
    if (/^Q\d+$/.test(best.meta.label)) return null;
    return { title: best.meta.label, positionQid: best.position };
  }

  // ── Assemble the plan ────────────────────────────────────────────────────────
  const plan: EnrichmentPlan = {
    titles: [],
    parties: [],
    stayGeneric: [],
    stats: {
      spineRows: spine.length,
      titleResolved: 0,
      titleStaysGeneric: 0,
      partylessConsidered: 0,
      partyResolved: 0,
      colorFromWikidata: 0,
      colorFromLegislature: 0,
      colorMissing: 0,
    },
  };

  for (const row of spine) {
    // TITLE — only propose when the office name is still a generic string.
    if (GENERIC_OFFICE_NAMES.has(row.officeName)) {
      const chosen = chooseTitle(row);
      if (chosen) {
        plan.stats.titleResolved++;
        plan.titles.push({
          country: row.country,
          role: row.officeType,
          officeId: row.officeId,
          oldName: row.officeName,
          newName: chosen.title,
          positionQid: chosen.positionQid,
        });
      } else {
        plan.stats.titleStaysGeneric++;
        plan.stayGeneric.push({
          country: row.country,
          role: row.officeType,
          person: row.personName,
          qid: row.personQid,
        });
      }
    }

    // PARTY — only propose where the current term has no party yet.
    if (!row.hasParty) {
      plan.stats.partylessConsidered++;
      const party = row.personQid ? partyByPerson.get(row.personQid) : undefined;
      if (party) {
        plan.stats.partyResolved++;
        let color = party.color;
        let colorSource: ProposedParty["colorSource"] = "none";
        if (color) {
          colorSource = "wikidata";
          plan.stats.colorFromWikidata++;
        } else {
          const legc = legColor.get(
            `${row.jurisdictionId}|${party.name.toLowerCase()}`
          );
          if (legc) {
            color = legc;
            colorSource = "legislature_parties";
            plan.stats.colorFromLegislature++;
          } else {
            plan.stats.colorMissing++;
          }
        }
        plan.parties.push({
          country: row.country,
          person: row.personName,
          role: row.officeType,
          termId: row.termId,
          party: party.name,
          color: color ?? null,
          colorSource,
        });
      }
    }
  }

  return plan;
}

/** Pretty-print the enrichment plan (dry-run report / apply summary). */
export function reportEnrichmentPlan(
  plan: EnrichmentPlan,
  log: (line: string) => void = (line) => console.log(line)
): void {
  const s = plan.stats;
  log("\n========================================================");
  log("  DRY RUN — proposed government/leadership enrichment");
  log("  (NOTHING written to the database)");
  log("========================================================\n");

  log("COVERAGE");
  log(`  Generic-title offices in scope:     ${s.spineRows}`);
  log(
    `  → would get a REAL title (P39):     ${s.titleResolved} (${Math.round(
      (s.titleResolved / s.spineRows) * 100
    )}%)`
  );
  log(`  → stay generic (no head-title P39): ${s.titleStaysGeneric} (kept honest)`);
  log(`  Partyless current terms considered: ${s.partylessConsidered}`);
  log(`  → would get a party (P102):          ${s.partyResolved}`);
  log(`     · with colour from Wikidata:     ${s.colorFromWikidata}`);
  log(`     · with colour from legislature:  ${s.colorFromLegislature}`);
  log(`     · party name only, no colour:    ${s.colorMissing}`);

  const sample = <T,>(arr: T[], n: number): T[] => arr.slice(0, n);

  log("\nTITLE SAMPLE (country · role · old → proposed)");
  for (const t of sample(plan.titles, 30)) {
    log(
      `  ${t.country} · ${t.role} · "${t.oldName}" → "${t.newName}"  (${t.positionQid})`
    );
  }

  log("\nPARTY SAMPLE (country · officeholder · party · colour)");
  for (const p of sample(
    plan.parties.filter((p) => p.color),
    18
  )) {
    log(`  ${p.country} · ${p.person} · ${p.party} · ${p.color} [${p.colorSource}]`);
  }
  const noColorParties = plan.parties.filter((p) => !p.color);
  log(
    `  …and ${noColorParties.length} parties with a name but NO colour (renders as a label, no dot). e.g.:`
  );
  for (const p of sample(noColorParties, 6)) {
    log(`    ${p.country} · ${p.person} · ${p.party} (no colour)`);
  }

  log("\nSTAY-GENERIC SAMPLE (no head-title P39 → name kept generic)");
  for (const g of sample(plan.stayGeneric, 12)) {
    log(`  ${g.country} · ${g.role} · ${g.person} (${g.qid ?? "no qid"})`);
  }

  log(
    "\nNo schema change. On APPLY, provenance is stamped via markSourcesSynced(\"wikidata\")."
  );
  log("Re-run without --dry-run to apply.\n");
}

/**
 * Run the FULL officeholder refresh: the base head-of-state / head-of-government
 * spine sync, unresolved-QID name resolution, AND the P39 title + P102/colour
 * party enrichment apply step — then stamp `sources.last_sync_at` via
 * `markSourcesSynced("wikidata", …)` (only when rows were written).
 *
 * This is the single implementation shared by the CLI script and the cron
 * route. It hits Wikidata (SPARQL + entity API) and takes ~10 minutes.
 */
export async function syncFactbookOfficeholders(
  options: OfficeholderSyncOptions = {}
): Promise<OfficeholderSyncSummary> {
  const db = options.db ?? sharedDb;
  const log = options.onProgress ?? (() => {});
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  log("=== Wikidata Officeholder Sync ===");
  log("Querying Wikidata SPARQL endpoint...");

  const bindings = await sparqlQuery(QUERY);
  log(`Got ${bindings.length} results`);

  let synced = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const binding of bindings) {
    const stateQid = extractQid(binding.state.value);
    if (seen.has(stateQid)) continue;
    seen.add(stateQid);

    const stateName = binding.stateLabel?.value ?? stateQid;
    const iso2 = binding.iso2?.value ?? null;
    const iso3 = binding.iso3?.value ?? null;
    const shortName = binding.shortName?.value ?? null;

    const jurisdictionId = await findJurisdiction(
      db,
      iso2,
      stateQid,
      stateName,
      shortName
    );
    if (!jurisdictionId) {
      skipped++;
      if (binding.headOfState?.value || binding.headOfGov?.value) {
        log(`! Skipped ${stateName} (${stateQid}) — no DB match, has leadership data`);
      }
      continue;
    }

    // Update wikidata QID and ISO codes on jurisdiction
    await db
      .update(jurisdictions)
      .set({
        wikidataQid: stateQid,
        iso2: iso2?.toUpperCase() ?? undefined,
        iso3: iso3?.toUpperCase() ?? undefined,
      })
      .where(eq(jurisdictions.id, jurisdictionId));

    const execBody = await upsertBody(
      db,
      jurisdictionId,
      `Executive of ${stateName}`,
      "executive"
    );

    // Head of State
    if (binding.headOfState?.value) {
      const hosQid = extractQid(binding.headOfState.value);
      const hosName = binding.headOfStateLabel?.value ?? hosQid;
      const hosStart = binding.hosStart?.value?.split("T")[0] ?? null;

      const personId = await upsertPerson(db, hosName, hosQid);
      const officeId = await upsertOffice(
        db,
        execBody,
        "Head of State",
        "head_of_state"
      );
      await upsertTerm(db, officeId, personId, hosStart);
      await upsertStatement(db, personId, "head_of_state", hosName, stateQid);
    }

    // Head of Government
    if (binding.headOfGov?.value) {
      const hogQid = extractQid(binding.headOfGov.value);
      const hogName = binding.headOfGovLabel?.value ?? hogQid;
      const hogStart = binding.hogStart?.value?.split("T")[0] ?? null;

      const personId = await upsertPerson(db, hogName, hogQid);
      const officeId = await upsertOffice(
        db,
        execBody,
        "Head of Government",
        "head_of_government"
      );
      await upsertTerm(db, officeId, personId, hogStart);
      await upsertStatement(db, personId, "head_of_government", hogName, stateQid);
    }

    synced++;
    log(`  ✓ ${stateName}`);
  }

  log(`=== Base Sync Complete ===`);
  log(`Synced:  ${synced}`);
  log(`Skipped: ${skipped}`);

  // Resolve any remaining QID-as-name persons via Wikidata entity API
  let qidNamesResolved = 0;
  const allPersons = await db
    .select({ id: persons.id, name: persons.name, wikidataQid: persons.wikidataQid })
    .from(persons);
  const qidPersons = allPersons.filter((p) => /^Q\d+$/.test(p.name));
  if (qidPersons.length > 0) {
    log(`Resolving ${qidPersons.length} unresolved QID names...`);
    for (const person of qidPersons) {
      const qid = person.wikidataQid ?? person.name;
      const realName = await resolveQidLabel(qid);
      if (realName) {
        await db.update(persons).set({ name: realName }).where(eq(persons.id, person.id));
        qidNamesResolved++;
        log(`  ✓ ${qid} → ${realName}`);
      } else {
        log(`  ✗ ${qid} — could not resolve`);
      }
    }
  }

  // ── Apply the P1 + P3 enrichment plan (real titles + party) ──────────────
  // Reuses the exact same computeEnrichmentPlan() the dry run reports on, so
  // what was approved in the dry-run preview is exactly what gets written.
  log("=== Applying government-title + party enrichment ===");
  const plan = await computeEnrichmentPlan(db, log);
  reportEnrichmentPlan(plan, log);

  let titlesWritten = 0;
  for (const t of plan.titles) {
    await db.update(offices).set({ name: t.newName }).where(eq(offices.id, t.officeId));
    titlesWritten++;
  }

  let partiesWritten = 0;
  for (const p of plan.parties) {
    if (!p.termId) continue;
    await db
      .update(terms)
      .set({ partyName: p.party, partyColor: p.color })
      .where(eq(terms.id, p.termId));
    partiesWritten++;
  }

  log(`=== Enrichment Applied ===`);
  log(`Titles written:  ${titlesWritten}`);
  log(`Parties written: ${partiesWritten}`);

  // Stamp source freshness via the single sanctioned helper — only when
  // this run actually synced rows (AGENTS.md provenance invariant). Total
  // covers the base sync plus the enrichment writes.
  const totalRowsWritten = synced + titlesWritten + partiesWritten;
  const stamped = await markSourcesSynced("wikidata", {
    rowsWritten: totalRowsWritten,
    executor: db,
  });

  const finishedAtMs = Date.now();
  log(`=== Sync Complete ===`);
  log(`Total rows written (base + titles + parties): ${totalRowsWritten}`);

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    countriesSynced: synced,
    countriesSkipped: skipped,
    qidNamesResolved,
    titlesWritten,
    partiesWritten,
    totalRowsWritten,
    freshnessStamped: stamped.length > 0,
  };
}
