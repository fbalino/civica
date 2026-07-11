import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import result from "../plan/evidence/DAT-021/restore-drill.json";
import releaseBom from "../data/releases/atlas-2026-07-11/manifest.v1.json";

const errors: string[] = [];
const fail = (message: string) => errors.push(message);

if (result.schemaVersion !== "backup-restore-drill/v1") fail("drill schema version drift");
if (result.result !== "pass") fail("checked drill is not passing");
if (result.sourceSafety.productionWrites !== 0) fail("production write count must be zero");
if (!result.sourceSafety.connection.includes("default_transaction_read_only=on")) fail("source connection is not recorded read-only");
if (result.logicalBackup.committed) fail("database dump must never be committed");
if (result.logicalBackup.sha256 !== result.recoveryPoint.logicalSnapshotSha256) fail("backup identity differs from recovery point");
if (!result.restoredDatabase.sourceCountsMatched || !result.restoredDatabase.sourceHashesMatched) fail("logical restore did not match source");
if (result.restoredDatabase.tableCounts.publicBaseTables !== 50) fail("restored public table count drift");
if (!result.pointInTimeRecovery.targetReached || !result.pointInTimeRecovery.beforeTargetMarkerPresent || !result.pointInTimeRecovery.afterTargetMarkerAbsent || !result.pointInTimeRecovery.sourceHashesMatchedAfterRecovery) fail("PITR target or recovered state failed");
if (result.restoredDatabase.availableDumpToVerifiedDatabaseMs <= 0 || result.pointInTimeRecovery.recoveryStartupMs <= 0) fail("recovery timing is missing");
if (result.releaseArchive.fileSha256 !== releaseBom.files[0].fileSha256 || result.releaseArchive.semanticSha256 !== releaseBom.files[0].semanticSha256 || result.releaseArchive.fileByteLength !== releaseBom.files[0].fileByteLength || result.releaseArchive.uncompressedByteLength !== releaseBom.files[0].uncompressedByteLength) fail("restored release archive differs from BOM");
if (JSON.stringify(result.releaseArchive.rowCounts) !== JSON.stringify(releaseBom.rowCounts)) fail("restored release row counts differ from BOM");
if (!result.releaseArchive.billOfMaterialsMatched) fail("release BOM verification is not passing");
if (result.missingExternalAssets.length < 4) fail("external restoration gaps are incomplete");

const runbook = readFileSync(resolve(process.cwd(), "data/BACKUP-RESTORE-DRILL.md"), "utf8");
for (const required of ["default_transaction_read_only=on", "pg_dump", "pg_restore", "pg_basebackup", "recovery.signal", "never a restore target", "Wikimedia Commons"]) {
  if (!runbook.toLowerCase().includes(required.toLowerCase())) fail(`runbook missing ${required}`);
}
const manual = readFileSync(resolve(process.cwd(), "plan/MANUAL-CHECKS.md"), "utf8");
if (!manual.includes("DAT-021") || !manual.includes("provider-managed Neon")) fail("provider PITR gap is absent from manual queue");
for (const prohibited of ["data/backups", "backup/production", "production-readonly.dump"]) {
  if (existsSync(resolve(process.cwd(), prohibited))) fail(`prohibited backup path is committed/present: ${prohibited}`);
}

console.log("=== DAT-021 backup and recovery drill ===\n");
console.log(`Logical restore to verified database: ${result.restoredDatabase.availableDumpToVerifiedDatabaseMs} ms`);
console.log(`Local PITR startup: ${result.pointInTimeRecovery.recoveryStartupMs} ms`);
console.log(`Recovered tables: ${result.pointInTimeRecovery.recoveredCounts.publicBaseTablesExcludingProbe}`);
console.log(`External gaps recorded: ${result.missingExternalAssets.length}`);
if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exit(1);
}
console.log("\nPASS — source safety, logical restore, WAL PITR, checksums, release archive, timings, and external gaps are closed.");
