import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { governmentTaxonomies, jurisdictions, sources } from "../src/lib/db/schema";
import { writeGovernmentTaxonomies, type GovernmentTaxonomyInput } from "../src/lib/government-taxonomy/writer";
import {
  BJORNKSKOV_RODE_DATASET_VERSION,
  BJORNKSKOV_RODE_SOURCE_DATASET_VERSION,
  BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR,
  BJORNKSKOV_RODE_SOURCE_ID,
  DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
  deriveRegimeTypeCgv,
} from "../src/lib/government-taxonomy";
import { governmentTaxonomyVersionEnvelope } from "../src/lib/government-taxonomy/versioning";
import { assertReferenceYear } from "../src/lib/data/temporal-metadata";

const QOG_CS_CSV_URL = "https://www.qogdata.pol.gu.se/data/qog_std_cs_jan26.csv";
const DRY_RUN = process.argv.includes("--dry-run");

type BjornskovRodeCsvRow = {
  iso3: string;
  brDem: number | null;
  brPres: number | null;
  brMon: number | null;
  brCom: number | null;
};

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
  return values.map((value) => value.replace(/\r$/, ""));
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchLatestBjornskovRodeRows() {
  const response = await fetch(QOG_CS_CSV_URL, {
    headers: { "User-Agent": "Civica taxonomy ingest" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download QoG CS CSV (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let header: string[] | null = null;
  let columnIndex: Record<string, number> | null = null;

  const latestByIso3 = new Map<string, BjornskovRodeCsvRow>();

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const columns = parseCsvLine(line);
    if (!header) {
      header = columns;
      columnIndex = Object.fromEntries(
        header.map((name, index) => [name, index]),
      );
      return;
    }
    if (!columnIndex) return;

    const iso3 = columns[columnIndex.ccodealp]?.trim().toUpperCase();
    if (!iso3) return;

    const row: BjornskovRodeCsvRow = {
      iso3,
      brDem: toNumber(columns[columnIndex.br_dem]),
      brPres: toNumber(columns[columnIndex.br_pres]),
      brMon: toNumber(columns[columnIndex.br_mon]),
      brCom: toNumber(columns[columnIndex.br_com]),
    };
    latestByIso3.set(iso3, row);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      handleLine(line);
    }
    if (done) break;
  }

  if (buffer.trim()) {
    handleLine(buffer);
  }

  return latestByIso3;
}

// Creating/ensuring the source row must NOT stamp freshness: that's the
// job of markSourcesSynced(), called from main() only after rows are
// actually ingested (AGENTS.md provenance invariant). This upsert keeps
// the source metadata current but leaves last_sync_at untouched.
async function ensureSource() {
  await db
    .insert(sources)
    .values({
      id: BJORNKSKOV_RODE_SOURCE_ID,
      name: "Bjornskov-Rode / CGV Regime Data",
      baseUrl: "https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset",
      license: "academic_noncommercial",
      isCommercialUseAllowed: false,
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        name: "Bjornskov-Rode / CGV Regime Data",
        baseUrl: "https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset",
        license: "academic_noncommercial",
        isCommercialUseAllowed: false,
      },
    });
}

async function main() {
  const syncTime = new Date();
  console.log("Downloading latest Bjornskov-Rode / CGV rows from QoG...");
  const latestByIso3 = await fetchLatestBjornskovRodeRows();
  console.log(
    `Fetched ${latestByIso3.size} latest country rows from the QoG Jan26 cross-section.`,
  );

  if (!DRY_RUN) await ensureSource();

  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
      governmentType: jurisdictions.governmentType,
      governmentTypeDetail: jurisdictions.governmentTypeDetail,
    })
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND ${jurisdictions.iso3} IS NOT NULL`,
    );

  const jurisdictionByIso3 = new Map(
    jurisdictionRows
      .filter((row) => row.iso3)
      .map((row) => [row.iso3!.toUpperCase(), row]),
  );

  const existingRows = await db
    .select()
    .from(governmentTaxonomies)
    .where(
      eq(
        governmentTaxonomies.taxonomyVersion,
        DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
      ),
    );

  const existingByJurisdictionId = new Map(
    existingRows.map((row) => [row.jurisdictionId, row]),
  );

  let matched = 0;
  let skipped = 0;
  const versions = governmentTaxonomyVersionEnvelope();
  const output: GovernmentTaxonomyInput[] = [];

  for (const latest of latestByIso3.values()) {
    const jurisdiction = jurisdictionByIso3.get(latest.iso3);
    if (!jurisdiction) {
      skipped += 1;
      continue;
    }

    const existing = existingByJurisdictionId.get(jurisdiction.id);
    const derived = deriveRegimeTypeCgv({
      slug: jurisdiction.slug,
      iso3: jurisdiction.iso3,
      governmentType: jurisdiction.governmentType,
      governmentTypeDetail: jurisdiction.governmentTypeDetail,
      regimeDatasetVersion: BJORNKSKOV_RODE_DATASET_VERSION,
      regimeYear: BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR,
      brDem: latest.brDem,
      brPres: latest.brPres,
      brMon: latest.brMon,
      brCom: latest.brCom,
    });
    assertReferenceYear({
      observationReferenceYear: derived.regimeYear,
      upstreamDatasetRelease: `${BJORNKSKOV_RODE_SOURCE_DATASET_VERSION} via ${BJORNKSKOV_RODE_DATASET_VERSION}`,
      retrievedAt: syncTime.toISOString(),
      civicaPublicationVersion: DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
    }, BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR, "BR/CGV cross-section");

    output.push({
        jurisdictionId: jurisdiction.id,
        taxonomyVersion: DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
        derivationVersionKey: versions.key,
        derivationVersions: versions.envelope,
        regimeTypeCgv: derived.regimeTypeCgv,
        regimeDatasetVersion: derived.regimeDatasetVersion,
        regimeSourceDatasetVersion: BJORNKSKOV_RODE_SOURCE_DATASET_VERSION,
        regimeYear: derived.regimeYear,
        regimeRetrievedAt: syncTime,
        civicaPublicationVersion: DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
        structuralFamily: existing?.structuralFamily ?? null,
        structuralSubtype: existing?.structuralSubtype ?? null,
        isFederal: existing?.isFederal ?? null,
        isMonarchy: existing?.isMonarchy ?? null,
        executiveStructure: existing?.executiveStructure ?? null,
        governmentDependency: existing?.governmentDependency ?? null,
        overrideNote: existing?.overrideNote ?? null,
        provenance: {
          ...(existing?.provenance ?? {}),
          regime: derived.provenance,
        },
        updatedAt: syncTime,
      });

    matched += 1;
  }

  console.log(`Upserted regime taxonomy for ${matched} jurisdictions.`);
  if (skipped > 0) {
    console.log(`Skipped ${skipped} QoG rows with no matching ISO3 in jurisdictions.`);
  }

  // Stamp source freshness via the single sanctioned helper — only when
  // this run actually ingested taxonomy rows (AGENTS.md provenance
  // invariant). Previously ensureSource() stamped last_sync_at
  // unconditionally before any data was written. `at: syncTime` aligns the
  // stamp with the row `updatedAt` values written in the loop above.
  await writeGovernmentTaxonomies(db, output, { dryRun: DRY_RUN, sourceId: BJORNKSKOV_RODE_SOURCE_ID });
}

main().catch((error) => {
  console.error("Government taxonomy BR ingest failed:", error);
  process.exit(1);
});
