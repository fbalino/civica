import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import { replayCandidateRelease, resolverVersionHash, type CandidateReleaseManifest, type FrozenCandidateObservation } from "../src/lib/factbook/reconcile/candidate-vintage";

config({ path: ".env.local", quiet: true });

interface OfflinePackage {
  schemaVersion: "reconciliation-offline-replay/v1";
  expected: CandidateReleaseManifest;
  candidates: FrozenCandidateObservation[];
}

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function candidateFromRow(row: Record<string, unknown>): FrozenCandidateObservation {
  return {
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
  };
}

async function exportPackage(path: string, vintageLabel: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for export");
  const sql = neon(process.env.DATABASE_URL);
  const [release] = await sql`SELECT *, to_char(cut_at_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cut_at_iso FROM country_fact_vintage_releases WHERE vintage_label=${vintageLabel} AND completeness_status='complete_candidates'`;
  if (!release) throw new Error(`Complete candidate release not found: ${vintageLabel}`);
  const rows = await sql`SELECT *, to_char(cut_at_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cut_at_iso FROM country_fact_vintage_candidates WHERE vintage_label=${vintageLabel} ORDER BY jurisdiction_id,fact_key,source_id`;
  const expected: CandidateReleaseManifest = {
    schemaVersion: "reconciliation-candidate-release/v1",
    vintageLabel,
    cutAt: String(release.cut_at_iso),
    methodologyVersion: String(release.methodology_version),
    resolverVersionHash: String(release.resolver_version_hash),
    candidateCount: Number(release.candidate_count),
    winnerCount: Number(release.winner_count),
    candidateSetChecksum: String(release.candidate_set_checksum),
    winnerSetChecksum: String(release.winner_set_checksum),
  };
  const payload: OfflinePackage = { schemaVersion: "reconciliation-offline-replay/v1", expected, candidates: rows.map(candidateFromRow) };
  writeFileSync(path, gzipSync(JSON.stringify(payload), { level: 9 }));
  console.log(`Exported ${payload.candidates.length} candidates to ${path}`);
}

function replayPackage(path: string) {
  let networkRequests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { networkRequests += 1; throw new Error("network forbidden during offline replay"); }) as typeof fetch;
  try {
    const payload = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as OfflinePackage;
    if (payload.schemaVersion !== "reconciliation-offline-replay/v1") throw new Error("Unsupported offline package schema");
    if (resolverVersionHash() !== payload.expected.resolverVersionHash) throw new Error("Resolver code differs from the frozen release; check out the recorded release code before replay");
    const replay = replayCandidateRelease({
      vintageLabel: payload.expected.vintageLabel,
      cutAt: payload.expected.cutAt,
      methodologyVersion: payload.expected.methodologyVersion,
      resolverVersionHash: payload.expected.resolverVersionHash,
      candidates: payload.candidates,
    });
    if (JSON.stringify(replay.manifest) !== JSON.stringify(payload.expected)) throw new Error("Offline replay manifest differs from the frozen release");
    if (networkRequests !== 0) throw new Error(`Offline replay attempted ${networkRequests} network requests`);
    console.log(JSON.stringify({ pass: true, networkRequests, ...replay.manifest }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  const exportPath = arg("export");
  const inputPath = arg("input");
  if (exportPath) return exportPackage(exportPath, arg("vintage") ?? "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2");
  if (inputPath) return replayPackage(inputPath);
  throw new Error("Use --export=<path> [--vintage=<label>] or --input=<path>");
}
main().catch((error) => { console.error(error); process.exit(1); });
