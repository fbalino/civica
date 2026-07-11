import type { MigrationArtifact } from "./migration-registry";
export function validateMigrationRegistry(entries: readonly MigrationArtifact[], sqlFiles: string[], dataScripts: string[], journalTags: string[], packageScripts: Record<string, string>): string[] {
  const errors: string[] = []; const ids = new Set<string>(); const paths = new Set<string>();
  for (const entry of entries) { if (ids.has(entry.id)) errors.push(`duplicate migration id: ${entry.id}`); ids.add(entry.id); if (paths.has(entry.path)) errors.push(`duplicate migration path: ${entry.path}`); paths.add(entry.path); for (const field of ["forwardArtifact", "rollbackOrCompensation", "dryRunPlan", "invariantPlan", "releaseNote"] as const) if (!entry[field]?.trim()) errors.push(`${entry.id} missing ${field}`); if (entry.forwardArtifact !== entry.path) errors.push(`${entry.id} forwardArtifact must equal path`); }
  for (const path of [...sqlFiles, ...dataScripts]) if (!paths.has(path)) errors.push(`unregistered migration artifact: ${path}`);
  for (const entry of entries) if (!sqlFiles.includes(entry.path) && !dataScripts.includes(entry.path)) errors.push(`registry path is not in the closed inventory: ${entry.path}`);
  for (const tag of journalTags) { const entry = entries.find((item) => item.id === tag); if (!entry) errors.push(`journal tag has no registry entry: ${tag}`); else if (entry.historyStatus !== "journaled") errors.push(`${tag} is journaled but registry says ${entry.historyStatus}`); }
  for (const entry of entries.filter((item) => item.historyStatus === "journaled")) if (!journalTags.includes(entry.id)) errors.push(`${entry.id} claims journaled but is absent from journal`);
  if (!packageScripts["db:plan"]?.includes("plan-migration")) errors.push("package db:plan does not use the read-only planner");
  if (!packageScripts["db:push"]?.includes("refuse-production-db-push")) errors.push("package db:push is not fail-closed");
  if (!packageScripts["db:push:local"]?.includes("db-push-local")) errors.push("package db:push:local lacks the explicit local-only wrapper");
  return errors;
}
