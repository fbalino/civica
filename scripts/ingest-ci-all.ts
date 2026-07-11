import { config } from "dotenv";
config({ path: ".env.local" });

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { canonicalStageChecksum, REQUIRED_CI_ADAPTERS, validateStagedCiRelease, type StagedCiAdapter } from "../src/lib/ci/atomic-ingestion";
import { sourceFreshnessTransactionQuery } from "../src/lib/db/source-freshness";

const ADAPTERS = [
  { key: "vdem:democratic_quality", name: "V-Dem (democratic_quality)", script: "ingest-ci-vdem.ts" },
  { key: "worldbank_wgi:rule_of_law", name: "World Bank WGI (rule_of_law)", script: "ingest-ci-wgi.ts" },
  { key: "worldbank_wgi:democratic_quality", name: "World Bank WGI (democratic_quality fallback)", script: "ingest-ci-wgi-democracy-fallback.ts" },
  { key: "freedom_house:freedom_rights", name: "Freedom House (freedom_rights)", script: "ingest-ci-freedom-house.ts" },
  { key: "transparency_intl:corruption_control", name: "Transparency Intl CPI (corruption_control)", script: "ingest-ci-cpi.ts" },
] as const;

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

interface AdapterResult { key: string; script: string; status: "completed" | "failed" | "not_run"; stageFile?: string; error?: string }

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (JSON.stringify(ADAPTERS.map((row) => row.key)) !== JSON.stringify(REQUIRED_CI_ADAPTERS)) throw new Error("orchestrator adapter inventory drift");
  const sql = neon(process.env.DATABASE_URL);
  const runId = randomUUID();
  const startedAt = new Date();
  const releaseLabel = `ci-stage-${process.env.CI_DATASET_YEAR ?? "default"}-${startedAt.toISOString()}-${runId}`;
  const stageDir = mkdtempSync(path.join(tmpdir(), "civica-ci-stage-"));
  const results: AdapterResult[] = ADAPTERS.map((adapter) => ({ key: adapter.key, script: adapter.script, status: "not_run" }));
  let runCreated = false;

  try {
    if (!DRY_RUN) {
      const [method] = await sql`SELECT id FROM ci_methodology_versions ORDER BY published_at DESC LIMIT 1`;
      if (!method?.id) throw new Error("No methodology version found");
      const datasetYear = Number(process.env.CI_DATASET_YEAR ?? 2024);
      const quarter = `${datasetYear}-Q4`;
      const previous = await sql`SELECT quarter, methodology_version, count(*)::int AS rows FROM ci_dimension_scores GROUP BY quarter, methodology_version ORDER BY quarter DESC LIMIT 1`;
      await sql`INSERT INTO ci_ingestion_runs (id,dataset_year,quarter,methodology_version,release_label,status,required_adapters,adapter_results,previous_visible_release) VALUES (${runId},${datasetYear},${quarter},${String(method.id)},${releaseLabel},'staging',${JSON.stringify(REQUIRED_CI_ADAPTERS)}::jsonb,'[]'::jsonb,${JSON.stringify(previous[0] ?? null)}::jsonb)`;
      runCreated = true;
    }

    for (let index = 0; index < ADAPTERS.length; index++) {
      const adapter = ADAPTERS[index];
      const stageFile = path.join(stageDir, `${index}.json`);
      try {
        if (process.env.CI_INGEST_FIXTURE_FAIL_ADAPTER === adapter.key) throw new Error("seeded adapter failure");
        execFileSync("npx", ["tsx", path.join(SCRIPTS_DIR, adapter.script)], {
          stdio: "inherit",
          env: { ...process.env, CI_INGEST_STAGE_FILE: stageFile, ...(index === 2 ? { CI_VDEM_STAGE_FILE: path.join(stageDir, "0.json") } : {}) },
        });
        results[index] = { key: adapter.key, script: adapter.script, status: "completed", stageFile };
      } catch (error) {
        results[index] = { key: adapter.key, script: adapter.script, status: "failed", error: error instanceof Error ? error.message : String(error) };
        throw new Error(`${adapter.name} failed`);
      }
    }

    const stages = results.map((result) => JSON.parse(readFileSync(result.stageFile!, "utf8")) as StagedCiAdapter);
    const validationErrors = validateStagedCiRelease(stages);
    if (validationErrors.length) throw new Error(validationErrors.join("; "));
    const checksum = canonicalStageChecksum(stages);
    if (DRY_RUN) {
      console.log(`PASS dry run — ${stages.length} adapters staged and validated; checksum ${checksum}; zero database writes.`);
      return;
    }

    const datasetYear = stages[0].datasetYear;
    const quarter = stages[0].quarter;
    const methodologyVersion = stages[0].methodologyVersion;
    const combinedRows = stages.flatMap((stage) => stage.rows.map((row) => ({ jurisdictionId: row.jurisdictionId, dimension: row.dimension, sourceId: row.sourceId, indicatorId: row.indicatorId })));
    const stagedDimensions = [...new Set(stages.map((stage) => stage.dimension))];
    const totalRows = stages.reduce((sum, stage) => sum + stage.rows.length, 0);
    const adapterManifest = stages.map((stage) => ({ key: stage.adapterKey, rows: stage.rows.length, skipped: stage.skipped, sourceId: stage.sourceId, dimension: stage.dimension }));

    await sql.transaction((txn) => [
      txn`DELETE FROM ci_dimension_scores d WHERE d.quarter=${quarter} AND d.methodology_version=${methodologyVersion} AND d.dimension=ANY(${stagedDimensions}) AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(${JSON.stringify(combinedRows)}::jsonb) AS x("jurisdictionId" uuid, dimension text,"sourceId" text,"indicatorId" text) WHERE x."jurisdictionId"=d.jurisdiction_id AND x.dimension=d.dimension AND x."sourceId"=d.source_id AND x."indicatorId"=d.indicator_id)`,
      ...stages.map((stage) => {
        const ingestionId = randomUUID();
        return txn`WITH ingestion AS (
          INSERT INTO ci_source_ingestions (id,source_id,dimension,indicator_id,upstream_release,artifact_hash,artifact_kind,temporal_coverage,license_url,transformation_id,substitution_reason,method_version,dataset_year,native_scale_min,native_scale_max,is_inverted,global_min_observed,global_max_observed,countries_covered,status)
          VALUES (${ingestionId},${stage.sourceId},${stage.dimension},${stage.rows[0].indicatorId},${stage.rows[0].upstreamRelease},${stage.rows[0].artifactHash},${stage.rows[0].artifactKind},${stage.rows[0].temporalCoverage},${stage.rows[0].licenseUrl},${stage.rows[0].transformationId},${stage.rows[0].substitutionReason},${stage.rows[0].methodVersion},${stage.datasetYear},${stage.nativeScaleMin},${stage.nativeScaleMax},${stage.isInverted},${stage.globalMinObserved},${stage.globalMaxObserved},${stage.countriesCovered},'completed')
          ON CONFLICT (source_id,dimension,dataset_year,indicator_id) DO UPDATE SET upstream_release=EXCLUDED.upstream_release,artifact_hash=EXCLUDED.artifact_hash,artifact_kind=EXCLUDED.artifact_kind,temporal_coverage=EXCLUDED.temporal_coverage,license_url=EXCLUDED.license_url,transformation_id=EXCLUDED.transformation_id,substitution_reason=EXCLUDED.substitution_reason,method_version=EXCLUDED.method_version,native_scale_min=EXCLUDED.native_scale_min,native_scale_max=EXCLUDED.native_scale_max,is_inverted=EXCLUDED.is_inverted,global_min_observed=EXCLUDED.global_min_observed,global_max_observed=EXCLUDED.global_max_observed,countries_covered=EXCLUDED.countries_covered,ingested_at=NOW(),status='completed',error_message=NULL
          RETURNING id
        )
        INSERT INTO ci_dimension_scores (jurisdiction_id,dimension,quarter,normalized_score,raw_value,source_id,indicator_id,upstream_release,artifact_hash,artifact_kind,temporal_coverage,license_url,transformation_id,substitution_reason,method_version,ingestion_id,methodology_version,derivation_version_key,derivation_versions)
        SELECT x."jurisdictionId",x.dimension,x.quarter,x."normalizedScore",x."rawValue",x."sourceId",x."indicatorId",x."upstreamRelease",x."artifactHash",x."artifactKind",x."temporalCoverage",x."licenseUrl",x."transformationId",x."substitutionReason",x."methodVersion",ingestion.id,x."methodologyVersion",x."derivationVersionKey",x."derivationVersions"
        FROM jsonb_to_recordset(${JSON.stringify(stage.rows)}::jsonb) AS x("jurisdictionId" uuid,"normalizedScore" real,"rawValue" real,"sourceId" text,"indicatorId" text,"upstreamRelease" text,"artifactHash" text,"artifactKind" text,"temporalCoverage" text,"licenseUrl" text,"transformationId" text,"substitutionReason" text,"methodVersion" text,dimension text,quarter text,"methodologyVersion" text,"derivationVersionKey" text,"derivationVersions" jsonb), ingestion
        ON CONFLICT (jurisdiction_id,dimension,quarter,methodology_version,source_id,indicator_id) DO UPDATE SET normalized_score=EXCLUDED.normalized_score,raw_value=EXCLUDED.raw_value,upstream_release=EXCLUDED.upstream_release,artifact_hash=EXCLUDED.artifact_hash,artifact_kind=EXCLUDED.artifact_kind,temporal_coverage=EXCLUDED.temporal_coverage,license_url=EXCLUDED.license_url,transformation_id=EXCLUDED.transformation_id,substitution_reason=EXCLUDED.substitution_reason,method_version=EXCLUDED.method_version,ingestion_id=EXCLUDED.ingestion_id,derivation_version_key=EXCLUDED.derivation_version_key,derivation_versions=EXCLUDED.derivation_versions`;
      }),
      sourceFreshnessTransactionQuery(txn, [...new Set(stages.map((stage) => stage.sourceId))], totalRows),
      txn`UPDATE ci_ingestion_runs SET status='completed',adapter_results=${JSON.stringify(adapterManifest)}::jsonb,staged_checksum=${checksum},completed_at=NOW(),error_message=NULL WHERE id=${runId}`,
    ]);
    console.log(`PASS — atomically published ${totalRows} scores for ${quarter}; run ${runId}; checksum ${checksum}.`);
  } catch (error) {
    if (runCreated) {
      await sql`UPDATE ci_ingestion_runs SET status='failed',adapter_results=${JSON.stringify(results)}::jsonb,error_message=${error instanceof Error ? error.message : String(error)},completed_at=NOW() WHERE id=${runId}`;
    }
    throw error;
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
