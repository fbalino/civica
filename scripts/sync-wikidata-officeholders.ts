import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, ilike } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
  offices,
  persons,
  terms,
  statements,
} from "../src/lib/db/schema";
import { sparqlQuery, extractQid } from "../src/lib/data/wikidata";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

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

async function findJurisdiction(iso2: string | null, qid: string, name: string, shortName: string | null) {
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

async function upsertPerson(name: string, qid: string): Promise<string> {
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
  officeId: string,
  personId: string,
  startDate: string | null
) {
  // Mark previous terms as not current
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

async function main() {
  console.log("=== Wikidata Officeholder Sync ===\n");
  console.log("Querying Wikidata SPARQL endpoint...");

  const bindings = await sparqlQuery(QUERY);
  console.log(`Got ${bindings.length} results\n`);

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

    const jurisdictionId = await findJurisdiction(iso2, stateQid, stateName, shortName);
    if (!jurisdictionId) {
      skipped++;
      if (binding.headOfState?.value || binding.headOfGov?.value) {
        console.log(`  ⚠ Skipped ${stateName} (${stateQid}) — no DB match, has leadership data`);
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
      jurisdictionId,
      `Executive of ${stateName}`,
      "executive"
    );

    // Head of State
    if (binding.headOfState?.value) {
      const hosQid = extractQid(binding.headOfState.value);
      const hosName = binding.headOfStateLabel?.value ?? hosQid;
      const hosStart = binding.hosStart?.value?.split("T")[0] ?? null;

      const personId = await upsertPerson(hosName, hosQid);
      const officeId = await upsertOffice(
        execBody,
        "Head of State",
        "head_of_state"
      );
      await upsertTerm(officeId, personId, hosStart);

      await db.insert(statements).values({
        subjectTable: "terms",
        subjectId: personId,
        predicate: "head_of_state",
        objectValue: hosName,
        sourceId: "wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${stateQid}`,
        sourceLicense: "CC0",
        retrievedAt: new Date(),
      });
    }

    // Head of Government
    if (binding.headOfGov?.value) {
      const hogQid = extractQid(binding.headOfGov.value);
      const hogName = binding.headOfGovLabel?.value ?? hogQid;
      const hogStart = binding.hogStart?.value?.split("T")[0] ?? null;

      const personId = await upsertPerson(hogName, hogQid);
      const officeId = await upsertOffice(
        execBody,
        "Head of Government",
        "head_of_government"
      );
      await upsertTerm(officeId, personId, hogStart);

      await db.insert(statements).values({
        subjectTable: "terms",
        subjectId: personId,
        predicate: "head_of_government",
        objectValue: hogName,
        sourceId: "wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${stateQid}`,
        sourceLicense: "CC0",
        retrievedAt: new Date(),
      });
    }

    synced++;
    console.log(`  ✓ ${stateName}`);
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Synced:  ${synced}`);
  console.log(`Skipped: ${skipped}`);

  // Resolve any remaining QID-as-name persons via Wikidata entity API
  const allPersons = await db
    .select({ id: persons.id, name: persons.name, wikidataQid: persons.wikidataQid })
    .from(persons);
  const qidPersons = allPersons.filter((p) => /^Q\d+$/.test(p.name));
  if (qidPersons.length > 0) {
    console.log(`\nResolving ${qidPersons.length} unresolved QID names...`);
    for (const person of qidPersons) {
      const qid = person.wikidataQid ?? person.name;
      const realName = await resolveQidLabel(qid);
      if (realName) {
        await db.update(persons).set({ name: realName }).where(eq(persons.id, person.id));
        console.log(`  ✓ ${qid} → ${realName}`);
      } else {
        console.log(`  ✗ ${qid} — could not resolve`);
      }
    }
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
