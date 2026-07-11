import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { governmentTaxonomies, jurisdictions } from "../src/lib/db/schema";
import {
  DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
  deriveStructuralTaxonomy,
} from "../src/lib/government-taxonomy";
import { governmentTaxonomyVersionEnvelope } from "../src/lib/government-taxonomy/versioning";
import { writeGovernmentTaxonomies, type GovernmentTaxonomyInput } from "../src/lib/government-taxonomy/writer";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const syncTime = new Date();
  const versions = governmentTaxonomyVersionEnvelope();

  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
      governmentType: jurisdictions.governmentType,
      governmentTypeDetail: jurisdictions.governmentTypeDetail,
    })
    .from(jurisdictions)
    .where(sql`${jurisdictions.type} = 'sovereign_state'`);

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
  const output: GovernmentTaxonomyInput[] = [];

  for (const jurisdiction of jurisdictionRows) {
    const existing = existingByJurisdictionId.get(jurisdiction.id);
    const structural = deriveStructuralTaxonomy({
      slug: jurisdiction.slug,
      iso3: jurisdiction.iso3,
      governmentType: jurisdiction.governmentType,
      governmentTypeDetail: jurisdiction.governmentTypeDetail,
    });

    output.push({
        jurisdictionId: jurisdiction.id,
        taxonomyVersion: DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
        derivationVersionKey: versions.key,
        derivationVersions: versions.envelope,
        regimeTypeCgv: existing?.regimeTypeCgv ?? null,
        regimeDatasetVersion: existing?.regimeDatasetVersion ?? null,
        regimeSourceDatasetVersion: existing?.regimeSourceDatasetVersion ?? null,
        regimeYear: existing?.regimeYear ?? null,
        regimeRetrievedAt: existing?.regimeRetrievedAt ?? null,
        civicaPublicationVersion: existing?.civicaPublicationVersion ?? null,
        structuralFamily: structural.structuralFamily,
        structuralSubtype: structural.structuralSubtype,
        isFederal: structural.isFederal,
        isMonarchy: structural.isMonarchy,
        executiveStructure: structural.executiveStructure,
        governmentDependency: structural.governmentDependency,
        overrideNote: structural.overrideNote,
        provenance: {
          ...(existing?.provenance ?? {}),
          structural: structural.provenance,
        },
        updatedAt: syncTime,
      });
  }

  await writeGovernmentTaxonomies(db, output, { dryRun: DRY_RUN });

  console.log(
    `Derived structural taxonomy for ${jurisdictionRows.length} sovereign-state jurisdictions.`,
  );
}

main().catch((error) => {
  console.error("Government taxonomy derivation failed:", error);
  process.exit(1);
});
