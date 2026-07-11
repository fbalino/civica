import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { K4_PRACTICE_PANEL_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";
import { K4_PAIRING_CONTRACT, K4_PAIRING_METHOD_VERSION, K4_PAIRING_YEAR, k4PairingErrors, k4PairingHash, runK4PairingPrototype, type K4ExcerptInput, type K4PracticeInput } from "../src/lib/ci/tournament-candidate-k4";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);

export async function buildK4PairingPrototype() {
const excerpts = await sql`SELECT e.jurisdiction_id::text AS "jurisdictionId",j.iso3,e.constitution_id::text AS "constitutionId",c.year AS "constitutionYear",c.constitute_project_id AS "constituteProjectId",e.topic_key AS "topicKey",e.topic_label AS "topicLabel",e.section_id AS "sectionId",e.article_label AS "articleLabel",e.excerpt_html AS "excerptHtml" FROM constitution_topic_excerpts e JOIN constitutions c ON c.id=e.constitution_id JOIN jurisdictions j ON j.id=e.jurisdiction_id WHERE j.type='sovereign_state' AND e.topic_key=ANY(${["express", "press", "opinion", "judind", "freeelec"]}) ORDER BY j.iso3,e.topic_key,e.section_id` as unknown as K4ExcerptInput[];
const practice = await sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",p.indicator_id AS "indicatorId",p.value,p.uncertainty_lower AS "uncertaintyLower",p.uncertainty_upper AS "uncertaintyUpper",p.missing_reason AS "missingReason",p.source_vintage AS "sourceVintage",p.artifact_hash AS "artifactHash" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${K4_PRACTICE_PANEL_RELEASE_ID} AND p.period_year=${K4_PAIRING_YEAR} ORDER BY j.iso3,p.indicator_id` as unknown as K4PracticeInput[];
const outputs = runK4PairingPrototype(excerpts, practice);
const errors = k4PairingErrors(outputs); if (errors.length) throw new Error(errors.join("\n"));
const manifest = { schemaVersion: "k4-pairing-prototype-manifest/v1", releaseId: "k4-constitution-practice-pairings-2024-v1", candidateId: "K4", methodVersion: K4_PAIRING_METHOD_VERSION, contractSha256: researchPanelHash(K4_PAIRING_CONTRACT), inputReleaseId: K4_PRACTICE_PANEL_RELEASE_ID, practiceYear: K4_PAIRING_YEAR, outputRows: outputs.length, bySplit: Object.fromEntries(["development", "validation", "final_holdout"].map((split) => [split, outputs.filter((row) => row.split === split).length])), candidateTaggedRows: outputs.filter((row) => row.constitutionalEvidence.codingState.startsWith("candidate")).length, noTaggedExcerptRows: outputs.filter((row) => row.constitutionalEvidence.codingState === "no_tagged_excerpt").length, observedPracticeRows: outputs.filter((row) => row.practiceEvidence.value !== null).length, outputSha256: k4PairingHash(outputs), valuesLocation: "private_reproducible_from_constitution_topic_excerpts_and_ci_research_panel_rows", confirmatoryLabelsInspected: false, validationStatus: "pending_two_blinded_coders_and_constitutional_scholar_review", prohibitedOutputs: K4_PAIRING_CONTRACT.prohibitions };
return { outputs, manifest };
}

async function main() {
const { manifest } = await buildK4PairingPrototype();
const dir = "data/releases/k4-constitution-practice-pairings-2024-v1"; mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/manifest.v1.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
}

if (process.argv[1]?.endsWith("generate-k4-pairing-prototype.ts")) main().catch((error) => { console.error(error); process.exit(1); });
