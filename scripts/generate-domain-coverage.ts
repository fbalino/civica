import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import galleries from "../src/lib/data/country-galleries.generated.json";
import {
  buildDomainCoverageReport,
  type DomainCoverageInput,
  type DomainCoverageReport,
  type DomainSourceInput,
} from "../src/lib/provenance/domain-coverage";

const OUTPUT = resolve(process.cwd(), "src/lib/provenance/domain-coverage.generated.json");
const threshold = {
  countryCoverageWarnBelow: 80,
  fieldCompletenessWarnBelow: 80,
  staleAfterDays: 180,
};

type CountRow = Record<string, string | number | null>;
type SourceRow = { id: string; name: string; lastSuccessfulRun: string | null };
const n = (row: CountRow, key: string) => Number(row[key] ?? 0);
const iso = (value: string | null) => {
  if (!value) return null;
  const normalized = /[zZ]|[+-]\d\d(?::?\d\d)?$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalized).toISOString();
};
const latest = (values: Array<string | null>) =>
  values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

async function collect(generatedAt: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const [eligibleRows, sourceRows, electionRows, constitutionRows, officeRows, peopleRows, partyRows, organizationRows, billRows, indicatorRows, portraitRows, sovereignRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM jurisdictions WHERE type = 'sovereign_state'`,
    sql`SELECT id, name, last_sync_at::text AS "lastSuccessfulRun" FROM sources ORDER BY id`,
    sql`SELECT COUNT(*)::int records, COUNT(DISTINCT e.jurisdiction_id)::int jurisdictions,
               COUNT(e.election_date)::int dates, COUNT(e.election_type)::int types,
               COUNT(e.turnout_percent)::int turnout
        FROM elections e JOIN jurisdictions j ON j.id=e.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`SELECT COUNT(*)::int records, COUNT(DISTINCT c.jurisdiction_id)::int jurisdictions,
               COUNT(c.year)::int years, COUNT(c.full_text_html)::int texts,
               COUNT(c.structured_articles)::int structured
        FROM constitutions c JOIN jurisdictions j ON j.id=c.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`SELECT COUNT(*)::int records, COUNT(DISTINCT b.jurisdiction_id)::int jurisdictions,
               COUNT(o.name)::int names, COUNT(o.office_type)::int types,
               COUNT(o.wikidata_qid)::int qids
        FROM offices o JOIN government_bodies b ON b.id=o.body_id
        JOIN jurisdictions j ON j.id=b.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`SELECT COUNT(DISTINCT p.id)::int records, COUNT(DISTINCT b.jurisdiction_id)::int jurisdictions,
               COUNT(DISTINCT p.id) FILTER (WHERE p.wikidata_qid IS NOT NULL)::int qids,
               COUNT(DISTINCT p.id) FILTER (WHERE p.date_of_birth IS NOT NULL)::int births
        FROM persons p JOIN terms t ON t.person_id=p.id JOIN offices o ON o.id=t.office_id
        JOIN government_bodies b ON b.id=o.body_id JOIN jurisdictions j ON j.id=b.jurisdiction_id
        WHERE j.type='sovereign_state'`,
    sql`SELECT COUNT(*)::int records, COUNT(DISTINCT b.jurisdiction_id)::int jurisdictions,
               COUNT(lp.seat_count)::int seats, COUNT(lp.wikidata_qid)::int qids
        FROM legislature_parties lp JOIN government_bodies b ON b.id=lp.body_id
        JOIN jurisdictions j ON j.id=b.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`SELECT (SELECT COUNT(*) FROM organizations)::int records,
               COUNT(DISTINCT om.jurisdiction_id)::int jurisdictions,
               (SELECT COUNT(*) FROM organizations WHERE wikidata_qid IS NOT NULL)::int qids,
               (SELECT COUNT(*) FROM organizations WHERE founded_year IS NOT NULL)::int founded,
               (SELECT COUNT(*) FROM organizations WHERE member_count IS NOT NULL)::int member_counts
        FROM organization_memberships om JOIN jurisdictions j ON j.id=om.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`SELECT COUNT(*)::int records, COUNT(DISTINCT b.jurisdiction_id)::int jurisdictions,
               COUNT(b.url)::int urls, COUNT(b.raw_status)::int statuses,
               COUNT(b.introduced_date)::int introduced
        FROM bills b JOIN jurisdictions j ON j.id=b.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`WITH observations AS (
          SELECT jurisdiction_id, source_id, value, value_status FROM country_metrics
          UNION ALL
          SELECT jurisdiction_id, source_id, value, value_status FROM indicator_history
        ) SELECT COUNT(*)::int records, COUNT(DISTINCT o.jurisdiction_id)::int jurisdictions,
                 COUNT(o.source_id)::int sources,
                 COUNT(*) FILTER (WHERE o.value_status <> 'observed' OR o.value IS NOT NULL)::int states
          FROM observations o JOIN jurisdictions j ON j.id=o.jurisdiction_id WHERE j.type='sovereign_state'`,
    sql`SELECT COUNT(DISTINCT p.id) FILTER (WHERE p.photo_url IS NOT NULL)::int portraits,
               COUNT(DISTINCT p.id) FILTER (WHERE p.photo_url IS NOT NULL AND p.photo_license IS NOT NULL AND p.photo_credit IS NOT NULL)::int attributed,
               COUNT(DISTINCT b.jurisdiction_id) FILTER (WHERE p.photo_url IS NOT NULL)::int jurisdictions
        FROM persons p JOIN terms t ON t.person_id=p.id JOIN offices o ON o.id=t.office_id
        JOIN government_bodies b ON b.id=o.body_id JOIN jurisdictions j ON j.id=b.jurisdiction_id
        WHERE j.type='sovereign_state'`,
    sql`SELECT iso3 FROM jurisdictions WHERE type='sovereign_state' AND iso3 IS NOT NULL ORDER BY iso3`,
  ]);

  const eligible = Number(eligibleRows[0]?.count ?? 0);
  const sources = (sourceRows as SourceRow[]).map((row) => ({
    ...row,
    lastSuccessfulRun: iso(row.lastSuccessfulRun),
  }));
  const sourceMap = new Map(sources.map((row) => [row.id, row]));
  const source = (ids: string[]): DomainSourceInput[] => ids.map((id) => {
    const row = sourceMap.get(id);
    return { id, label: row?.name ?? id, family: id, lastSuccessfulRun: row?.lastSuccessfulRun ?? null };
  });
  const sourceLast = (rows: DomainSourceInput[]) => latest(rows.map((row) => row.lastSuccessfulRun));
  const one = (rows: unknown[]) => (rows[0] ?? {}) as CountRow;
  const e = one(electionRows); const c = one(constitutionRows); const o = one(officeRows);
  const p = one(peopleRows); const pa = one(partyRows); const org = one(organizationRows);
  const b = one(billRows); const i = one(indicatorRows); const portrait = one(portraitRows);

  const sovereignIso3 = new Set((sovereignRows as Array<{ iso3: string }>).map((row) => row.iso3));
  const galleryRows = Object.entries(galleries.galleries).filter(([iso3]) => sovereignIso3.has(iso3));
  const galleryPhotos = galleryRows.flatMap(([, gallery]) => gallery.photos);
  const galleryJurisdictions = galleryRows.filter(([, gallery]) => gallery.photos.length > 0).length;
  const galleryAttributed = galleryPhotos.filter((photo) => photo.license).length;
  const galleryRun = iso(galleries._meta.fetchedAt);

  const electionSources = source(["ipu_parline", "wikidata", "international_idea"]);
  const constitutionSources = source(["constitute_project"]);
  const officeSources = source(["cia_world_leaders", "wikidata", "ipu_parline"]);
  const peopleSources = source(["cia_world_leaders", "wikidata", "ipu_parline"]);
  const partySources = source(["ipu_parline", "wikidata", "vparty"]);
  const billSourceIds = (await sql`SELECT DISTINCT b.source_id AS id FROM bills b JOIN jurisdictions j ON j.id=b.jurisdiction_id WHERE j.type='sovereign_state' ORDER BY b.source_id`) as Array<{ id: string }>;
  const billSources = source(billSourceIds.map((row) => row.id));
  const indicatorSourceIds = (await sql`SELECT DISTINCT source_id AS id FROM (SELECT cm.source_id FROM country_metrics cm JOIN jurisdictions j ON j.id=cm.jurisdiction_id WHERE j.type='sovereign_state' UNION SELECT ih.source_id FROM indicator_history ih JOIN jurisdictions j ON j.id=ih.jurisdiction_id WHERE j.type='sovereign_state') x ORDER BY id`) as Array<{ id: string }>;
  const indicatorSources = source(indicatorSourceIds.map((row) => row.id));
  const imageSources: DomainSourceInput[] = [
    { id: "wikimedia_commons_galleries", label: "Wikimedia Commons country galleries", family: "wikimedia_commons", lastSuccessfulRun: galleryRun },
    ...source(["wikidata"]),
  ];
  const organizationsSources: DomainSourceInput[] = [{ id: "civica_curated_organizations", label: "Civica curated organization seed", family: "manual_curation", lastSuccessfulRun: null }];

  const domains: DomainCoverageInput[] = [
    { id: "elections", label: "Elections", recordLabel: "election records", recordCount: n(e,"records"), jurisdictionsCovered: n(e,"jurisdictions"), completeness: [
      { field:"election_date",label:"Election date",complete:n(e,"dates"),total:n(e,"records") }, { field:"election_type",label:"Election type",complete:n(e,"types"),total:n(e,"records") }, { field:"turnout_percent",label:"Turnout",complete:n(e,"turnout"),total:n(e,"records") },
    ], sources:electionSources,lastSuccessfulRun:sourceLast(electionSources),knownGaps:["Presidential, legislative, and turnout coverage have different publisher scopes; a jurisdiction count does not imply every election type or result field is present."],threshold },
    { id:"constitutions",label:"Constitutions",recordLabel:"constitution records",recordCount:n(c,"records"),jurisdictionsCovered:n(c,"jurisdictions"),completeness:[
      {field:"year",label:"Adoption year",complete:n(c,"years"),total:n(c,"records")},{field:"full_text_html",label:"Full text",complete:n(c,"texts"),total:n(c,"records")},{field:"structured_articles",label:"Structured articles",complete:n(c,"structured"),total:n(c,"records")},
    ],sources:constitutionSources,lastSuccessfulRun:latest([sourceLast(constitutionSources), ...((constitutionRows as CountRow[]).map(()=>null))]),knownGaps:["Constitute coverage and reuse terms limit the corpus; structured topic extraction is available only where parsable source HTML was retained."],threshold},
    { id:"offices",label:"Offices",recordLabel:"office records",recordCount:n(o,"records"),jurisdictionsCovered:n(o,"jurisdictions"),completeness:[
      {field:"name",label:"Office name",complete:n(o,"names"),total:n(o,"records")},{field:"office_type",label:"Office type",complete:n(o,"types"),total:n(o,"records")},{field:"wikidata_qid",label:"Wikidata identifier",complete:n(o,"qids"),total:n(o,"records")},
    ],sources:officeSources,lastSuccessfulRun:sourceLast(officeSources),knownGaps:["Cabinet depth varies by publisher and office identifiers remain incomplete; coverage counts any jurisdiction with at least one office."],threshold},
    { id:"people",label:"People",recordLabel:"person records",recordCount:n(p,"records"),jurisdictionsCovered:n(p,"jurisdictions"),completeness:[
      {field:"wikidata_qid",label:"Wikidata identifier",complete:n(p,"qids"),total:n(p,"records")},{field:"date_of_birth",label:"Date of birth",complete:n(p,"births"),total:n(p,"records")},
    ],sources:peopleSources,lastSuccessfulRun:sourceLast(peopleSources),knownGaps:["The denominator is people linked to an office term, not every politically relevant person; birth dates and stable identifiers are publisher-dependent."],threshold},
    { id:"parties",label:"Parties",recordLabel:"legislature-party records",recordCount:n(pa,"records"),jurisdictionsCovered:n(pa,"jurisdictions"),completeness:[
      {field:"seat_count",label:"Seat count",complete:n(pa,"seats"),total:n(pa,"records")},{field:"wikidata_qid",label:"Wikidata identifier",complete:n(pa,"qids"),total:n(pa,"records")},
    ],sources:partySources,lastSuccessfulRun:sourceLast(partySources),knownGaps:["Party rows are legislature snapshots rather than a global party registry; V-Party positions cover only confidently matched parties in its frozen vintage."],threshold},
    { id:"organizations",label:"Organizations",recordLabel:"organization records",recordCount:n(org,"records"),jurisdictionsCovered:n(org,"jurisdictions"),completeness:[
      {field:"wikidata_qid",label:"Wikidata identifier",complete:n(org,"qids"),total:n(org,"records")},{field:"founded_year",label:"Founded year",complete:n(org,"founded"),total:n(org,"records")},{field:"member_count",label:"Member count",complete:n(org,"member_counts"),total:n(org,"records")},
    ],sources:organizationsSources,lastSuccessfulRun:null,knownGaps:["Organization memberships are a manually curated seed without a registered successful-run timestamp or complete source-level provenance; the alert remains open until that pipeline is replaced."],threshold},
    { id:"bills",label:"Bills",recordLabel:"bill records",recordCount:n(b,"records"),jurisdictionsCovered:n(b,"jurisdictions"),completeness:[
      {field:"url",label:"Source URL",complete:n(b,"urls"),total:n(b,"records")},{field:"raw_status",label:"Publisher status",complete:n(b,"statuses"),total:n(b,"records")},{field:"introduced_date",label:"Introduction date",complete:n(b,"introduced"),total:n(b,"records")},
    ],sources:billSources,lastSuccessfulRun:sourceLast(billSources),knownGaps:["Production bill adapters currently cover six legislatures; summaries and vote fields are not consistently available from publishers."],threshold},
    { id:"indicators",label:"Indicators",recordLabel:"indicator observations",recordCount:n(i,"records"),jurisdictionsCovered:n(i,"jurisdictions"),completeness:[
      {field:"source_id",label:"Source identifier",complete:n(i,"sources"),total:n(i,"records")},{field:"value_state",label:"Valid value or absence state",complete:n(i,"states"),total:n(i,"records")},
    ],sources:indicatorSources,lastSuccessfulRun:sourceLast(indicatorSources),knownGaps:["This combines Atlas country metrics and research indicator history; source vintages and product eligibility differ, and presence does not imply inclusion in the Civica Index."],threshold},
    { id:"images",label:"Images",recordLabel:"country photos and person portraits",recordCount:galleryPhotos.length+n(portrait,"portraits"),jurisdictionsCovered:galleryJurisdictions,completeness:[
      {field:"country_photo_license",label:"Country photo license metadata",complete:galleryAttributed,total:galleryPhotos.length},{field:"portrait_attribution",label:"Portrait license and credit",complete:n(portrait,"attributed"),total:n(portrait,"portraits")},
    ],sources:imageSources,lastSuccessfulRun:sourceLast(imageSources),knownGaps:["Country coverage counts jurisdictions with at least one gallery photo; person portraits are reported as a separate completeness metric and do not expand the country-photo denominator."],threshold},
  ];
  return buildDomainCoverageReport({ generatedAt, eligibleJurisdictions: eligible, domains });
}

async function main() {
  const check = process.argv.includes("--check");
  const checked = check ? JSON.parse(readFileSync(OUTPUT, "utf8")) as DomainCoverageReport : null;
  const report = await collect(checked?.generatedAt ?? new Date().toISOString());
  if (check) {
    if (JSON.stringify(report) !== JSON.stringify(checked)) throw new Error("live domain coverage differs from the checked report; regenerate and review it");
    console.log("PASS — live domain coverage matches the checked report.");
    return;
  }
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT}`);
  console.log(JSON.stringify(report.summary));
}

main().catch((error) => { console.error(error); process.exit(1); });
