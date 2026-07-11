import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import sourceManifest from "../data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json";
import spineArtifact from "../data/releases/ci-beta-r3-2024-Q4/jurisdiction-spine.v1.json";
import {
  applyFrozenReleaseCoverage, parseFreedomHouse, parseTransparencyCpi, parseVdemCore,
  parseWgiRuleOfLaw, parseWgiVoiceAccountability, wgiFallbackRecords,
} from "../src/lib/ci/production-source-adapters";
import { buildIso3ByCountryNameRows, fetchBuffer } from "../src/lib/ci/source-utils";
import { reproduceCurrentCiRelease, type CiSpineRow } from "../src/lib/ci/reproduce-current-release";
import { CURRENT_CI_METHODOLOGY_VERSION, CURRENT_CI_QUARTER, CURRENT_CI_RELEASE_ID, CURRENT_CI_VINTAGE_LABEL } from "../src/lib/ci/current-release";

config({ path: ".env.local" });
const outputPath = "data/releases/ci-beta-r3-2024-Q4/reproduction-manifest.v1.json";
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const inputs = sourceManifest.inputs;
const capture = (id: string) => { const row = inputs.find((input) => input.sourceId === id); if (!row) throw new Error(`Missing source capture ${id}`); return row; };

async function main() {
  const downloaded = new Map<string, Buffer>();
  for (const id of ["vdem", "worldbank_wgi", "freedom_house", "transparency_intl"]) {
    process.stderr.write(`Fetching declared ${id} snapshot...\n`);
    downloaded.set(id, await fetchBuffer(capture(id).accessUrl));
  }
  const vdemBytes = downloaded.get("vdem")!;
  const wgiBytes = downloaded.get("worldbank_wgi")!;
  const freedomBytes = downloaded.get("freedom_house")!;
  const cpiBytes = downloaded.get("transparency_intl")!;
  const bytesBySource = { vdem:vdemBytes, worldbank_wgi:wgiBytes, freedom_house:freedomBytes, transparency_intl:cpiBytes };
  const inputHashes = Object.fromEntries(Object.entries(bytesBySource).map(([id, bytes]) => [id, sha256(bytes)]));
  for (const [id, hash] of Object.entries(inputHashes)) if (hash !== capture(id).contentSha256) throw new Error(`${id} bytes differ from the declared capture`);
  const spine = spineArtifact.rows as CiSpineRow[];
  if (spine.length !== spineArtifact.rowCount || sha256(JSON.stringify(spine)) !== spineArtifact.sha256) throw new Error("Jurisdiction spine hash/count drift");
  const countryNames = buildIso3ByCountryNameRows(spine);
  const vdem = applyFrozenReleaseCoverage(parseVdemCore(vdemBytes), "vdem.democratic_quality");
  const wgiRule = applyFrozenReleaseCoverage(parseWgiRuleOfLaw(wgiBytes), "worldbank_wgi.rule_of_law");
  const fallback = applyFrozenReleaseCoverage(wgiFallbackRecords(parseWgiVoiceAccountability(wgiBytes), new Set(vdem.records.map((row) => row.iso3))), "worldbank_wgi.democratic_quality_fallback");
  const freedom = applyFrozenReleaseCoverage(parseFreedomHouse(freedomBytes, countryNames).ingestion, "freedom_house.freedom_rights");
  const cpi = applyFrozenReleaseCoverage(parseTransparencyCpi(cpiBytes), "transparency_intl.corruption_control");
  const reproduction = reproduceCurrentCiRelease(spine, [vdem, fallback, wgiRule, freedom, cpi]);
  const manifest = {
    schemaVersion: "ci-clean-room-reproduction/v1", releaseId: CURRENT_CI_RELEASE_ID,
    quarter: CURRENT_CI_QUARTER, methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION, vintageLabel: CURRENT_CI_VINTAGE_LABEL,
    inputManifest: "data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json", inputSha256: inputHashes,
    jurisdictionSpine: { path: "data/releases/ci-beta-r3-2024-Q4/jurisdiction-spine.v1.json", rowCount: spine.length, sha256: spineArtifact.sha256 },
    algorithm: { simulations: 10_000, randomization: "deterministic per-jurisdiction Mulberry32 seed over release, period, identity, ordered dimensions, sources, and raw values" },
    dimensions: { rows: reproduction.dimensions.length, sha256: reproduction.dimensionSha256 },
    composites: { rows: reproduction.composites.length, sha256: reproduction.compositeSha256 },
    tolerance: { identities: "exact", rawAndNormalizedDimensions: "absolute difference <= 0.00001 for PostgreSQL real storage", compositeFields: "exact" },
  };
  if (process.argv.includes("--write")) writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  else {
    const checked = JSON.parse(readFileSync(outputPath, "utf8"));
    if (JSON.stringify(checked) !== JSON.stringify(manifest)) throw new Error("Checked reproduction manifest differs from clean-room output");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for exact live comparison");
  const sql = neon(process.env.DATABASE_URL);
  const liveDimensions = await sql`SELECT d.jurisdiction_id::text AS "jurisdictionId",j.iso3,d.dimension,d.indicator_id AS "indicatorId",d.source_id AS "sourceId",d.raw_value AS "rawValue",d.normalized_score AS "normalizedScore",d.quarter,d.methodology_version AS "methodologyVersion" FROM ci_dimension_scores d JOIN jurisdictions j ON j.id=d.jurisdiction_id WHERE d.quarter=${CURRENT_CI_QUARTER} AND d.methodology_version=${CURRENT_CI_METHODOLOGY_VERSION} ORDER BY j.iso3,d.dimension,d.source_id,d.indicator_id`;
  const liveComposites = await sql`SELECT c.jurisdiction_id::text AS "jurisdictionId",j.iso3,c.score,c.score_lower AS "scoreLower",c.score_upper AS "scoreUpper",c.completeness_flag AS "completenessFlag",c.rank,c.total_ranked AS "totalRanked",c.is_partial AS "isPartial",c.dimensions_available AS "dimensionsAvailable",c.missing_dimensions AS "missingDimensions",c.quarter,c.methodology_version AS "methodologyVersion",c.vintage_label AS "vintageLabel" FROM ci_composite_scores c JOIN jurisdictions j ON j.id=c.jurisdiction_id WHERE c.quarter=${CURRENT_CI_QUARTER} AND c.methodology_version=${CURRENT_CI_METHODOLOGY_VERSION} ORDER BY c.jurisdiction_id`;
  const dimensionErrors: string[] = [];
  const dimensionStorageDifferences: string[] = [];
  if (liveDimensions.length !== reproduction.dimensions.length) dimensionErrors.push(`row count ${liveDimensions.length}/${reproduction.dimensions.length}`);
  for (let index=0; index<Math.min(liveDimensions.length,reproduction.dimensions.length); index++) {
    const live=liveDimensions[index] as Record<string,unknown>, expected=reproduction.dimensions[index] as unknown as Record<string,unknown>;
    for (const key of ["jurisdictionId","iso3","dimension","indicatorId","sourceId","quarter","methodologyVersion"]) if (live[key] !== expected[key]) dimensionErrors.push(`${index}/${key}`);
    for (const key of ["rawValue","normalizedScore"]) if (Math.abs(Number(live[key])-Number(expected[key])) > 0.00001) dimensionErrors.push(`${index}/${key}`);
    for (const key of ["rawValue", "normalizedScore"]) if (Number(live[key]) !== Number(expected[key])) dimensionStorageDifferences.push(`${String(expected.iso3)}/${key}:${String(live[key])}->${String(expected[key])}`);
  }
  const compositeErrors: string[] = [];
  if (liveComposites.length !== reproduction.composites.length) compositeErrors.push(`row count ${liveComposites.length}/${reproduction.composites.length}`);
  const expectedComposites = [...reproduction.composites].sort((a, b) => a.jurisdictionId.localeCompare(b.jurisdictionId));
  for (let index=0; index<Math.min(liveComposites.length,expectedComposites.length); index++) {
    const live=liveComposites[index] as Record<string,unknown>, expected=expectedComposites[index] as unknown as Record<string,unknown>;
    for (const key of Object.keys(expected)) if (JSON.stringify(live[key]) !== JSON.stringify(expected[key])) compositeErrors.push(`${String(expected.iso3)}/${key}:${JSON.stringify(live[key])}->${JSON.stringify(expected[key])}`);
  }
  const report = { ...manifest, live: { dimensionRows: liveDimensions.length, compositeRows: liveComposites.length, dimensionErrors, dimensionStorageDifferences, compositeErrors, unexplainedRows: Math.abs(liveDimensions.length-reproduction.dimensions.length)+Math.abs(liveComposites.length-reproduction.composites.length), pass: dimensionErrors.length===0&&compositeErrors.length===0 } };
  console.log(JSON.stringify(report, null, 2));
  if (!report.live.pass) process.exit(1);
}
main().catch((error) => { console.error(error); process.exit(1); });
