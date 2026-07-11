import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR } from "../src/lib/government-taxonomy";

config({ path: ".env.local" });

async function main() {
  const errors: string[] = [];
  const ingest = readFileSync("scripts/ingest-government-taxonomy-br.ts", "utf8");
  const apiSchema = readFileSync("src/lib/api/contract/schemas.ts", "utf8");
  const methodology = readFileSync("content/methodology-peer-grouping.md", "utf8");
  if (/QOG_LATEST_REGIME_YEAR\s*=\s*2025/.test(ingest)) errors.push("BR ingest still aliases time-series endpoint to cross-section reference year");
  for (const field of ["observationReferenceYear", "upstreamDatasetRelease", "retrievedAt", "civicaPublicationVersion"]) if (!apiSchema.includes(field)) errors.push(`API schema lacks ${field}`);
  if (!methodology.includes("brCgvReferenceYear") || !methodology.includes("separate clocks")) errors.push("peer-grouping methodology lacks separated temporal labels");
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required for live temporal audit");
  else {
    const sql = neon(process.env.DATABASE_URL);
    const [atlas] = await sql`SELECT count(*)::int total, count(civica_publication_version)::int publication, count(*) FILTER (WHERE civica_publication_version <> vintage_label)::int publication_mismatches, count(observation_reference_year)::int reference_years, count(upstream_dataset_release)::int upstream_releases, count(source_retrieved_at)::int retrieval_times, count(*) FILTER (WHERE source_retrieved_at > cut_at_timestamp)::int post_cut_retrievals FROM country_fact_vintages`;
    const [regime] = await sql`SELECT count(*)::int total, count(*) FILTER (WHERE regime_year <> ${BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR})::int reference_year_mismatches, count(*) FILTER (WHERE regime_dataset_version <> 'QoG Standard Jan26')::int distribution_mismatches, count(*) FILTER (WHERE regime_source_dataset_version <> 'Bjørnskov-Rode regime data v6.1')::int source_release_mismatches, count(*) FILTER (WHERE regime_retrieved_at IS NULL)::int retrieval_missing, count(*) FILTER (WHERE civica_publication_version <> taxonomy_version)::int publication_mismatches FROM government_taxonomies WHERE regime_type_cgv IS NOT NULL`;
    if (Number(atlas.publication) !== Number(atlas.total)) errors.push("Atlas publication version coverage is incomplete");
    for (const key of ["publication_mismatches", "post_cut_retrievals"]) if (Number(atlas[key]) !== 0) errors.push(`Atlas ${key}: ${atlas[key]}`);
    for (const [key, value] of Object.entries(regime)) if (key !== "total" && Number(value) !== 0) errors.push(`BR/CGV ${key}: ${value}`);
    console.log(`Atlas: ${atlas.total} rows; reference year ${atlas.reference_years}; upstream release/retrieval ${atlas.upstream_releases}/${atlas.retrieval_times}.`);
    console.log(`BR/CGV: ${regime.total} rows; reference year ${BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR}; distribution QoG Jan26.`);
  }
  if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
  console.log("PASS — observation year, upstream release, retrieval time, and Civica publication version remain separate.");
}
main().catch((error) => { console.error(error); process.exit(1); });
