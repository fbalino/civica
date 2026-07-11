import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { csvObjects, fetchBuffer } from "../src/lib/ci/source-utils";
import { LONGITUDINAL_VALIDATION_INPUTS } from "../src/lib/ci/longitudinal-validation-inputs";
import {
  LONGITUDINAL_VALIDATION_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");
export async function buildLongitudinalValidationInputs() {
  const buffer = await fetchBuffer(
    LONGITUDINAL_VALIDATION_INPUTS.captures.qogJan26.url,
  );
  const hash = createHash("sha256").update(buffer).digest("hex");
  if (hash !== LONGITUDINAL_VALIDATION_INPUTS.captures.qogJan26.sha256)
    throw new Error(`QoG hash drift ${hash}`);
  const records = csvObjects(
    buffer.toString("utf8"),
    (row) =>
      row.includes("ccodealp") &&
      row.includes("year") &&
      row.includes("br_dem"),
  );
  const byKey = new Map(
    records.map((r) => [`${r.ccodealp?.toUpperCase()}:${r.year}`, r.br_dem]),
  );
  const spine =
    (await sql`SELECT id::text AS id,iso3 FROM jurisdictions WHERE type='sovereign_state' AND iso3 IS NOT NULL ORDER BY iso3`) as unknown as {
      id: string;
      iso3: string;
    }[];
  if (spine.length !== 194) throw new Error("sovereign spine drift");
  const aliases: Record<string, string> = { PSE: "PSX" };
  const rows = spine.flatMap((j) =>
    Array.from({ length: 23 }, (_, i) => {
      const year = 2000 + i;
      const raw = byKey.get(`${aliases[j.iso3] ?? j.iso3}:${year}`);
      const parsed = raw === undefined || raw === "" ? null : Number(raw);
      const value = parsed === 0 || parsed === 1 ? parsed : null;
      const core = {
        releaseId: LONGITUDINAL_VALIDATION_RELEASE_ID,
        jurisdictionId: j.id,
        periodYear: year,
        dimension: "regime_democracy_label",
        indicatorId: "br_dem",
        sourceId: "bjornskov_rode",
        sourceOwner: "Bjørnskov-Rode / CGV via QoG Standard",
        retrievalPath: "exact_publisher_archive",
        value,
        valueStatus: value === null ? "missing" : "observed",
        missingReason:
          value === null
            ? "source_no_observation_for_jurisdiction_period"
            : null,
        nativeUnit: "binary 0/1",
        nativeMin: 0,
        nativeMax: 1,
        isInverted: false,
        transformId: "identity_binary/v1",
        sourceVintage: "QoG Standard time-series Jan26 / BR regime data v6.1",
        sourceVintageStatus: "exact_publisher_archive_hash",
        artifactHash: hash,
        uncertaintyStatus: "no_per_country_probability_distribution_published",
        uncertaintyLower: null,
        uncertaintyUpper: null,
        revisionStatus: "revisable_current_harmonized_series",
        seriesType: "current_harmonized_backcast_not_as_published",
      };
      return { ...core, contentHash: researchPanelHash(core) };
    }),
  );
  rows.sort((a, b) =>
    `${a.periodYear}:${a.jurisdictionId}`.localeCompare(
      `${b.periodYear}:${b.jurisdictionId}`,
    ),
  );
  const coverage = {
    expected: rows.length,
    observed: rows.filter((r) => r.valueStatus === "observed").length,
    missing: rows.filter((r) => r.valueStatus === "missing").length,
  };
  const breaks = [
    {
      period: "Jan24–Jan26 releases",
      treatment:
        "retain exact editions for revision comparison; never rewrite older capture",
    },
    {
      period: "country-year series through 2022",
      treatment:
        "2023–2024 K1 rows have no BR label and are excluded from event tests",
    },
  ];
  const manifest = {
    ...LONGITUDINAL_VALIDATION_INPUTS,
    scope: { jurisdictions: 194, years: 23, indicators: 1, ...coverage },
    rowSha256: researchPanelHash(rows),
    coverageSha256: researchPanelHash(coverage),
    temporalBreaksSha256: researchPanelHash(breaks),
    breaks,
    valuesLocation: "private_neon_ci_research_panel_rows",
  };
  return { rows, manifest };
}
async function main() {
  const built = await buildLongitudinalValidationInputs();
  if (write) {
    const e =
      await sql`SELECT status,row_sha256 FROM ci_research_panel_releases WHERE id=${LONGITUDINAL_VALIDATION_RELEASE_ID}`;
    if (e[0]?.status === "complete") {
      if (e[0].row_sha256 !== built.manifest.rowSha256)
        throw new Error("immutable release hash differs");
    } else {
      if (!e[0])
        await sql`INSERT INTO ci_research_panel_releases(id,schema_version,status,period_start,period_end,jurisdiction_count,indicator_count,expected_rows,observed_rows,missing_rows,row_sha256,coverage_sha256,temporal_breaks_sha256,generator_version,source_snapshot,rights_posture)VALUES(${LONGITUDINAL_VALIDATION_RELEASE_ID},${LONGITUDINAL_VALIDATION_INPUTS.schemaVersion},'staging',2000,2022,194,1,${built.manifest.scope.expected},${built.manifest.scope.observed},${built.manifest.scope.missing},${built.manifest.rowSha256},${built.manifest.coverageSha256},${built.manifest.temporalBreaksSha256},'longitudinal-validation-input-generator/v1',${JSON.stringify(LONGITUDINAL_VALIDATION_INPUTS.captures)}::jsonb,${LONGITUDINAL_VALIDATION_INPUTS.rights.posture})`;
      for (let i = 0; i < built.rows.length; i += 500)
        await sql`INSERT INTO ci_research_panel_rows(release_id,jurisdiction_id,period_year,dimension,indicator_id,source_id,source_owner,retrieval_path,value,value_status,missing_reason,native_unit,native_min,native_max,is_inverted,transform_id,source_vintage,source_vintage_status,artifact_hash,uncertainty_status,uncertainty_lower,uncertainty_upper,revision_status,series_type,content_hash)SELECT x."releaseId",x."jurisdictionId",x."periodYear",x.dimension,x."indicatorId",x."sourceId",x."sourceOwner",x."retrievalPath",x.value,x."valueStatus",x."missingReason",x."nativeUnit",x."nativeMin",x."nativeMax",x."isInverted",x."transformId",x."sourceVintage",x."sourceVintageStatus",x."artifactHash",x."uncertaintyStatus",x."uncertaintyLower",x."uncertaintyUpper",x."revisionStatus",x."seriesType",x."contentHash" FROM jsonb_to_recordset(${JSON.stringify(built.rows.slice(i, i + 500))}::jsonb)AS x("releaseId" text,"jurisdictionId" uuid,"periodYear" int,dimension text,"indicatorId" text,"sourceId" text,"sourceOwner" text,"retrievalPath" text,value real,"valueStatus" text,"missingReason" text,"nativeUnit" text,"nativeMin" real,"nativeMax" real,"isInverted" boolean,"transformId" text,"sourceVintage" text,"sourceVintageStatus" text,"artifactHash" text,"uncertaintyStatus" text,"uncertaintyLower" real,"uncertaintyUpper" real,"revisionStatus" text,"seriesType" text,"contentHash" text)ON CONFLICT DO NOTHING`;
      await sql`UPDATE ci_research_panel_releases SET status='complete',completed_at=NOW()WHERE id=${LONGITUDINAL_VALIDATION_RELEASE_ID} AND status='staging'`;
    }
    const dir = `data/releases/${LONGITUDINAL_VALIDATION_RELEASE_ID}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/manifest.v1.json`,
      `${JSON.stringify(built.manifest, null, 2)}\n`,
    );
  }
  console.log(JSON.stringify(built.manifest, null, 2));
}
if (process.argv[1]?.endsWith("generate-longitudinal-validation-inputs.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
