import { createHash } from "node:crypto";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import type { MigrationArtifact } from "./migration-registry";

export function affectedRelations(entry: MigrationArtifact, source: string): string[] {
  const names = new Set<string>();
  if (entry.path.endsWith(".sql")) {
    const declared = source.match(/--\s*civica-affected-relations:\s*([^\n]+)/i)?.[1];
    for (const name of declared?.split(",") ?? []) {
      const normalized = name.trim();
      if (/^[a-z][a-z0-9_]*$/.test(normalized)) names.add(normalized);
    }
    if (declared) return [...names].sort();
    const sqlOnly = source.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/'(?:''|[^'])*'/g, "''");
    const keywords = new Set(["all", "delete", "update", "cascade", "restrict", "conflict", "on", "set", "select", "where", "values", "when", "current_date", "no", "public"]);
    for (const match of sqlOnly.matchAll(/(?:TABLE|INTO|UPDATE|FROM|JOIN|REFERENCES|ON)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["']?([a-z][a-z0-9_]*)["']?/gi)) if (!keywords.has(match[1].toLowerCase())) names.add(match[1]);
  } else {
    for (const [exportName, value] of Object.entries(schema)) {
      if (!new RegExp(`\\b${exportName}\\b`).test(source)) continue;
      try { names.add(getTableConfig(value as never).name); } catch { /* not a table */ }
    }
  }
  return [...names].sort();
}

export function buildMigrationPlan(entry: MigrationArtifact, source: string) {
  const executable = source.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/'(?:''|[^'])*'/g, "''");
  const statements = entry.path.endsWith(".sql") ? executable.split(/--> statement-breakpoint|;\s*(?:\n|$)/).map((value) => value.trim()).filter(Boolean) : [];
  return { id: entry.id, artifact: entry.path, kind: entry.kind, historyStatus: entry.historyStatus, sha256: createHash("sha256").update(source).digest("hex"), affectedRelations: affectedRelations(entry, source), statementCount: statements.length, destructiveStatementCount: statements.filter((value) => /^\s*(DROP|TRUNCATE|DELETE)\b/i.test(value)).length, rollbackOrCompensation: entry.rollbackOrCompensation, invariantPlan: entry.invariantPlan, releaseNote: entry.releaseNote };
}
