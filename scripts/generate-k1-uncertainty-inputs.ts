import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  fetchBuffer,
  forEachCsvRow,
  rowsToObjects,
  xlsxSheetRows,
  zipEntryText,
} from "../src/lib/ci/source-utils";
import { K1_UNCERTAINTY_INPUTS } from "../src/lib/ci/k1-uncertainty-inputs";
import {
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  K1_UNCERTAINTY_INPUT_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL),
  write = process.argv.includes("--write"),
  sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
async function exact(c: { url: string; sha256: string }) {
  const b = await fetchBuffer(c.url);
  if (sha(b) !== c.sha256) throw new Error(`hash drift ${c.url}`);
  return b;
}
function selected(text: string, cols: string[]) {
  let idx: number[] | null = null;
  const out: Record<string, string>[] = [];
  forEachCsvRow(text, (row) => {
    if (!idx) {
      if (cols.every((c) => row.includes(c)))
        idx = cols.map((c) => row.indexOf(c));
      return;
    }
    const o: Record<string, string> = {};
    cols.forEach((c, i) => (o[c] = row[idx![i]] ?? ""));
    out.push(o);
  });
  return out;
}
const num = (v: string | undefined) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
};
export async function buildK1UncertaintyInputs() {
  const [vdemBuffer, wgiBuffer, cpiBuffer] = await Promise.all([
    exact(K1_UNCERTAINTY_INPUTS.captures.vdem),
    exact(K1_UNCERTAINTY_INPUTS.captures.wgi),
    exact(K1_UNCERTAINTY_INPUTS.captures.cpi),
  ]);
  const bounds = new Map<
    string,
    { point: number; lower: number; upper: number; status: string }
  >();
  for (const r of selected(
    zipEntryText(vdemBuffer, (n) => n.includes("V-Dem-CY-Core-v15.csv")),
    [
      "country_text_id",
      "year",
      "v2x_libdem",
      "v2x_libdem_codelow",
      "v2x_libdem_codehigh",
    ],
  )) {
    if (Number(r.year) !== 2024) continue;
    const point = num(r.v2x_libdem),
      l = num(r.v2x_libdem_codelow),
      u = num(r.v2x_libdem_codehigh);
    if (point !== null && l !== null && u !== null)
      bounds.set(`vdem:v2x_libdem:${r.country_text_id}`, {
        point,
        lower: l,
        upper: u,
        status: "publisher_credible_region",
      });
  }
  for (const sheet of ["va", "rl"]) {
    const rows = rowsToObjects(
      xlsxSheetRows(wgiBuffer, sheet),
      (r) =>
        r.includes("Economy (code)") &&
        r.includes("Year") &&
        r.includes("Lower threshold (90% conf. int. estimate)"),
    );
    for (const r of rows) {
      if (Number(r.Year) !== 2024) continue;
      const l = num(r["Lower threshold (90% conf. int. estimate)"]),
        u = num(r["Upper threshold (90% conf. int. estimate)"]),
        point = num(r["Governance estimate (approx. -2.5 to +2.5)"]);
      if (point !== null && l !== null && u !== null)
        bounds.set(`worldbank_wgi:${sheet}.est:${r["Economy (code)"]}`, {
          point,
          lower: l,
          upper: u,
          status: "publisher_90pct_interval",
        });
    }
  }
  for (const r of rowsToObjects(
    xlsxSheetRows(cpiBuffer, "CPI 2024"),
    (x) => x.includes("ISO3") && x.includes("Lower CI"),
  )) {
    const point = num(r["CPI 2024 score"]),
      l = num(r["Lower CI"]),
      u = num(r["Upper CI"]);
    if (point !== null && l !== null && u !== null)
      bounds.set(`transparency_intl:score:${r.ISO3}`, {
        point,
        lower: l,
        upper: u,
        status: "publisher_confidence_interval",
      });
  }
  const base =
  (await sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.dimension,p.indicator_id AS "indicatorId",p.source_id AS "sourceId",p.source_owner AS "sourceOwner",p.value,p.value_status AS "valueStatus",p.missing_reason AS "missingReason",p.native_unit AS "nativeUnit",p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted",p.source_vintage AS "sourceVintage",p.artifact_hash AS "artifactHash",p.revision_status AS "revisionStatus",p.series_type AS "seriesType" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND p.period_year=2024 AND(p.source_id||':'||p.indicator_id)=ANY(${K1_UNCERTAINTY_INPUTS.identities}) ORDER BY p.source_id,p.indicator_id,j.iso3`) as unknown as Array<Record<string, unknown>>;
  if (base.length !== 970) throw new Error(`base grid ${base.length}`);
  const rows = base.map((r) => {
    const b = bounds.get(`${r.sourceId}:${r.indicatorId}:${r.iso3}`);
    const exactArtifactHash =
      r.sourceId === "vdem"
        ? K1_UNCERTAINTY_INPUTS.captures.vdem.sha256
        : r.sourceId === "worldbank_wgi"
          ? K1_UNCERTAINTY_INPUTS.captures.wgi.sha256
          : r.sourceId === "transparency_intl"
            ? K1_UNCERTAINTY_INPUTS.captures.cpi.sha256
            : K1_UNCERTAINTY_INPUTS.captures.freedomHouse.sha256;
    const core = {
      releaseId: K1_UNCERTAINTY_INPUT_RELEASE_ID,
      jurisdictionId: r.jurisdictionId,
      periodYear: 2024,
      dimension: r.dimension,
      indicatorId: r.indicatorId,
      sourceId: r.sourceId,
      sourceOwner: r.sourceOwner,
      retrievalPath: "exact_publisher_archive",
      value: b?.point ?? (r.value === null ? null : Number(r.value)),
      valueStatus: r.valueStatus,
      missingReason: r.missingReason,
      nativeUnit: r.nativeUnit,
      nativeMin: Number(r.nativeMin),
      nativeMax: Number(r.nativeMax),
      isInverted: r.isInverted,
      transformId: "identity_native_scale/v1",
      sourceVintage: b ? "exact 2024 publisher release" : r.sourceVintage,
      sourceVintageStatus: "exact_hash_pinned_release",
      artifactHash: exactArtifactHash,
      uncertaintyStatus:
        b?.status ??
        (r.sourceId === "freedom_house"
          ? "no_per_country_probability_distribution_published"
          : "publisher_interval_missing_for_row"),
      uncertaintyLower: b?.lower ?? null,
      uncertaintyUpper: b?.upper ?? null,
      revisionStatus: r.revisionStatus,
      seriesType: r.seriesType,
    };
    return { ...core, contentHash: researchPanelHash(core) };
  });
  const coverage = K1_UNCERTAINTY_INPUTS.identities.map((identity) => {
    const [sourceId, indicatorId] = identity.split(":");
    const x = rows.filter(
      (r) => r.sourceId === sourceId && r.indicatorId === indicatorId,
    );
    return {
      identity,
      observed: x.filter((r) => r.valueStatus === "observed").length,
      bounded: x.filter((r) => r.uncertaintyLower !== null).length,
      missing: x.filter((r) => r.valueStatus === "missing").length,
    };
  });
  const scope = {
    jurisdictions: 194,
    indicators: 5,
    expected: 970,
    observed: rows.filter((r) => r.valueStatus === "observed").length,
    missing: rows.filter((r) => r.valueStatus === "missing").length,
  };
  const manifest = {
    ...K1_UNCERTAINTY_INPUTS,
    scope,
    coverage,
    rowSha256: researchPanelHash(rows),
    coverageSha256: researchPanelHash(coverage),
    temporalBreaksSha256: researchPanelHash([
      { year: 2024, treatment: "cross-sectional uncertainty sensitivity only" },
    ]),
    valuesLocation: "private_neon_ci_research_panel_rows",
  };
  return { rows, manifest };
}
async function main() {
  const b = await buildK1UncertaintyInputs();
  if (write) {
    const e =
      await sql`SELECT status,row_sha256 FROM ci_research_panel_releases WHERE id=${K1_UNCERTAINTY_INPUT_RELEASE_ID}`;
    if (e[0]?.status === "complete") {
      if (e[0].row_sha256 !== b.manifest.rowSha256)
        throw new Error("immutable hash differs");
    } else {
      if (!e[0])
        await sql`INSERT INTO ci_research_panel_releases(id,schema_version,status,period_start,period_end,jurisdiction_count,indicator_count,expected_rows,observed_rows,missing_rows,row_sha256,coverage_sha256,temporal_breaks_sha256,generator_version,source_snapshot,rights_posture)VALUES(${K1_UNCERTAINTY_INPUT_RELEASE_ID},${K1_UNCERTAINTY_INPUTS.schemaVersion},'staging',2024,2024,194,5,970,${b.manifest.scope.observed},${b.manifest.scope.missing},${b.manifest.rowSha256},${b.manifest.coverageSha256},${b.manifest.temporalBreaksSha256},'k1-uncertainty-input-generator/v1',${JSON.stringify(K1_UNCERTAINTY_INPUTS.captures)}::jsonb,${K1_UNCERTAINTY_INPUTS.rights.posture})`;
      for (let i = 0; i < b.rows.length; i += 500)
        await sql`INSERT INTO ci_research_panel_rows(release_id,jurisdiction_id,period_year,dimension,indicator_id,source_id,source_owner,retrieval_path,value,value_status,missing_reason,native_unit,native_min,native_max,is_inverted,transform_id,source_vintage,source_vintage_status,artifact_hash,uncertainty_status,uncertainty_lower,uncertainty_upper,revision_status,series_type,content_hash)SELECT x."releaseId",x."jurisdictionId",x."periodYear",x.dimension,x."indicatorId",x."sourceId",x."sourceOwner",x."retrievalPath",x.value,x."valueStatus",x."missingReason",x."nativeUnit",x."nativeMin",x."nativeMax",x."isInverted",x."transformId",x."sourceVintage",x."sourceVintageStatus",x."artifactHash",x."uncertaintyStatus",x."uncertaintyLower",x."uncertaintyUpper",x."revisionStatus",x."seriesType",x."contentHash" FROM jsonb_to_recordset(${JSON.stringify(b.rows.slice(i, i + 500))}::jsonb)AS x("releaseId" text,"jurisdictionId" uuid,"periodYear" int,dimension text,"indicatorId" text,"sourceId" text,"sourceOwner" text,"retrievalPath" text,value real,"valueStatus" text,"missingReason" text,"nativeUnit" text,"nativeMin" real,"nativeMax" real,"isInverted" bool,"transformId" text,"sourceVintage" text,"sourceVintageStatus" text,"artifactHash" text,"uncertaintyStatus" text,"uncertaintyLower" real,"uncertaintyUpper" real,"revisionStatus" text,"seriesType" text,"contentHash" text)ON CONFLICT DO NOTHING`;
      await sql`UPDATE ci_research_panel_releases SET status='complete',completed_at=NOW()WHERE id=${K1_UNCERTAINTY_INPUT_RELEASE_ID} AND status='staging'`;
    }
    const dir = `data/releases/${K1_UNCERTAINTY_INPUT_RELEASE_ID}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/manifest.v1.json`,
      `${JSON.stringify(b.manifest, null, 2)}\n`,
    );
  }
  console.log(JSON.stringify(b.manifest, null, 2));
}
if (process.argv[1]?.endsWith("generate-k1-uncertainty-inputs.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
