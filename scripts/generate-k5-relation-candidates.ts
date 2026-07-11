import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { researchPanelHash } from "../src/lib/ci/research-panel";
import { K5_RELATION_CONTRACT, K5_RELATION_METHOD_VERSION, K5_RELATION_TAXONOMY, k5RelationErrors, k5RelationHash, runK5RelationCandidateExtraction, type K5ExcerptInput } from "../src/lib/ci/tournament-candidate-k5";

config({ path: ".env.local" }); if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required"); const sql = neon(process.env.DATABASE_URL);

export async function buildK5RelationCandidates() {
  const excerpts = await sql`SELECT e.jurisdiction_id::text AS "jurisdictionId",j.iso3,e.constitution_id::text AS "constitutionId",c.year AS "constitutionYear",c.constitute_project_id AS "constituteProjectId",e.topic_key AS "topicKey",e.topic_label AS "topicLabel",e.section_id AS "sectionId",e.article_label AS "articleLabel",e.excerpt_html AS "excerptHtml" FROM constitution_topic_excerpts e JOIN constitutions c ON c.id=e.constitution_id JOIN jurisdictions j ON j.id=e.jurisdiction_id WHERE j.type='sovereign_state' AND e.topic_key=ANY(${K5_RELATION_TAXONOMY.map((row) => row.topicKey)}) ORDER BY j.iso3,e.topic_key,e.section_id` as unknown as K5ExcerptInput[];
  const outputs = runK5RelationCandidateExtraction(excerpts); const errors = k5RelationErrors(outputs); if (errors.length) throw new Error(errors.join("\n"));
  const byRelation = [...new Set(outputs.map((row) => row.relationType))].sort().map((relationType) => ({ relationType, candidates: outputs.filter((row) => row.relationType === relationType).length }));
  const bySplit = (["development", "validation", "final_holdout"] as const).map((split) => ({ split, candidates: outputs.filter((row) => row.split === split).length }));
  const manifest = { schemaVersion: "k5-relation-candidate-manifest/v1", releaseId: "k5-institutional-relation-candidates-v1", candidateId: "K5", methodVersion: K5_RELATION_METHOD_VERSION, contractSha256: researchPanelHash(K5_RELATION_CONTRACT), source: { table: "constitution_topic_excerpts", upstream: "Constitute Project", rightsPosture: "private_internal_research_only_noncommercial_source", valuesIncluded: false }, candidateRows: outputs.length, jurisdictions: new Set(outputs.map((row) => row.jurisdictionId)).size, byRelation, bySplit, outputSha256: k5RelationHash(outputs), heldoutLabelsInspected: false, validationStatus: "pending_double_blind_coding_external_expert_and_citation_audit", graphEdgesPublished: 0, prohibitedOutputs: K5_RELATION_CONTRACT.prohibitions };
  return { outputs, manifest };
}

async function main() { const { manifest } = await buildK5RelationCandidates(); const dir = "data/releases/k5-institutional-relation-candidates-v1"; mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/manifest.v1.json`, `${JSON.stringify(manifest, null, 2)}\n`); console.log(JSON.stringify(manifest, null, 2)); }
if (process.argv[1]?.endsWith("generate-k5-relation-candidates.ts")) main().catch((error) => { console.error(error); process.exit(1); });
