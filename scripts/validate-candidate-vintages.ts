import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import { replayCandidateRelease, type FrozenCandidateObservation } from "../src/lib/factbook/reconcile/candidate-vintage";

config({ path: ".env.local", quiet: true });
const COMPLETE = "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2";
const LEGACY = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1";

async function main() {
  const errors: string[] = [];
  const migration = readFileSync("drizzle/authoritative/0005_freeze_reconciliation_candidates.sql", "utf8") + readFileSync("drizzle/authoritative/0006_staged_candidate_publication.sql", "utf8");
  const writer = readFileSync("src/lib/factbook/reconcile/snapshot-candidate-release.ts", "utf8");
  const reader = readFileSync("src/lib/factbook/read-selection.ts", "utf8");
  for (const token of ["country_fact_vintage_candidates", "candidate_set_checksum", "canonical_candidate_id", "dat_032_immutable_candidates", "dat_032_immutable_candidate_releases", "linked_winners"])
    if (!migration.includes(token)) errors.push(`migration lacks ${token}`);
  for (const token of ["buildCandidateReleasePackage", "onConflictDoNothing", 'completenessStatus: "staging"', 'completenessStatus: "complete_candidates"'])
    if (!writer.includes(token)) errors.push(`writer lacks ${token}`);
  if (!reader.includes("countryFactVintageReleases") || !reader.includes('"complete_candidates", "canonical_only_legacy"')) errors.push("public selection can expose an incomplete staged release");

  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
    const sql = neon(process.env.DATABASE_URL);
    const releases = await sql`SELECT *, to_char(cut_at_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cut_at_iso FROM country_fact_vintage_releases ORDER BY vintage_label`;
    const complete = releases.find((row) => row.vintage_label === COMPLETE);
    const legacy = releases.find((row) => row.vintage_label === LEGACY);
    if (legacy?.completeness_status !== "canonical_only_legacy") errors.push("Q1 is not honestly disclosed as canonical-only legacy");
    if (complete?.completeness_status !== "complete_candidates") errors.push("Q2 complete candidate release is absent");
    const [counts] = await sql`SELECT
      count(*)::int candidates,
      count(*) FILTER (WHERE is_canonical_at_cut)::int candidate_winners,
      count(*) FILTER (WHERE source_id IS NULL OR input_evidence_hash IS NULL OR adapter_version_hash IS NULL OR candidate_content_hash IS NULL OR candidate_status IS NULL)::int incomplete
      FROM country_fact_vintage_candidates WHERE vintage_label=${COMPLETE}`;
    const [winners] = await sql`SELECT count(*)::int winners,
      count(*) FILTER (WHERE canonical_candidate_id IS NULL)::int missing_pointer,
      count(*) FILTER (WHERE c.id IS NULL OR NOT c.is_canonical_at_cut)::int bad_pointer
      FROM country_fact_vintages v LEFT JOIN country_fact_vintage_candidates c
        ON c.id=v.canonical_candidate_id AND c.vintage_label=v.vintage_label
      WHERE v.vintage_label=${COMPLETE}`;
    if (Number(counts.candidates) !== Number(complete?.candidate_count) || Number(counts.candidate_winners) !== Number(complete?.winner_count) || Number(counts.incomplete) !== 0) errors.push("candidate closure counts or required evidence fail");
    if (Number(winners.winners) !== Number(complete?.winner_count) || Number(winners.missing_pointer) !== 0 || Number(winners.bad_pointer) !== 0) errors.push("winner pointers do not close over immutable candidates");

    const rows = await sql`SELECT *, to_char(cut_at_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cut_at_iso FROM country_fact_vintage_candidates WHERE vintage_label=${COMPLETE} ORDER BY jurisdiction_id,fact_key,source_id`;
    const candidates: FrozenCandidateObservation[] = rows.map((row) => ({
      schemaVersion: "reconciliation-candidate-snapshot/v1",
      vintageLabel: String(row.vintage_label),
      cutAt: String(row.cut_at_iso),
      candidate: row.candidate_payload as FrozenCandidateObservation["candidate"],
      sourceRowId: String(row.source_row_id),
      sourceHash: row.source_hash == null ? null : String(row.source_hash),
      sourceSnapshotId: row.source_snapshot_id == null ? null : String(row.source_snapshot_id),
      inputEvidenceKind: row.input_evidence_kind as FrozenCandidateObservation["inputEvidenceKind"],
      inputEvidenceHash: String(row.input_evidence_hash),
      adapterVersionHash: String(row.adapter_version_hash),
      candidateContentHash: String(row.candidate_content_hash),
    }));
    const replay = replayCandidateRelease({
      vintageLabel: COMPLETE,
      cutAt: String(complete?.cut_at_iso),
      methodologyVersion: String(complete?.methodology_version),
      resolverVersionHash: String(complete?.resolver_version_hash),
      candidates,
    });
    if (replay.manifest.candidateSetChecksum !== complete?.candidate_set_checksum || replay.manifest.winnerSetChecksum !== complete?.winner_set_checksum) errors.push("offline replay checksum differs from published release");
    let candidateMutationRejected = false;
    try {
      await sql`UPDATE country_fact_vintage_candidates SET candidate_status=candidate_status WHERE vintage_label=${COMPLETE} AND id=(SELECT id FROM country_fact_vintage_candidates WHERE vintage_label=${COMPLETE} LIMIT 1)`;
    } catch { candidateMutationRejected = true; }
    if (!candidateMutationRejected) errors.push("database allowed mutation of a completed candidate snapshot");
    console.log(`Live complete release: ${counts.candidates} candidates, ${winners.winners} winners; ${replay.manifest.candidateSetChecksum}`);
  }

  console.log("=== DAT-032 complete reconciliation candidate vintages ===\n");
  if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
  console.log("PASS — candidate inputs, evidence hashes, immutable winner pointers, staged publication, and offline replay close.");
}
main().catch((error) => { console.error(error); process.exit(1); });
