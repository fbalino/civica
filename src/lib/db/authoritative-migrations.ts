import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stableStringify } from "@/lib/data/frozen-vintage";

export interface AuthoritativeMigration {
  id: string;
  path: string;
  sha256: string;
  baseline: boolean;
}

export function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

/** PostgreSQL-aware enough for checked migrations: respects comments, strings, and dollar-quoted function bodies. */
export function splitPostgresStatements(source: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let single = false;
  let double = false;
  let dollar: string | null = null;
  let lineComment = false;
  let blockCommentDepth = 0;
  for (let i = 0; i < source.length; i++) {
    if (dollar) {
      if (source.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; }
      continue;
    }
    const ch = source[i];
    if (single) {
      if (ch === "'" && source[i + 1] === "'") i++;
      else if (ch === "'") single = false;
      continue;
    }
    if (double) {
      if (ch === '"' && source[i + 1] === '"') i++;
      else if (ch === '"') double = false;
      continue;
    }
    if (lineComment) {
      if (ch === "\n" || ch === "\r") lineComment = false;
      continue;
    }
    if (blockCommentDepth > 0) {
      if (ch === "/" && source[i + 1] === "*") { blockCommentDepth++; i++; }
      else if (ch === "*" && source[i + 1] === "/") { blockCommentDepth--; i++; }
      continue;
    }
    if (ch === "'") { single = true; continue; }
    if (ch === '"') { double = true; continue; }
    if (ch === "-" && source[i + 1] === "-") { lineComment = true; i++; continue; }
    if (ch === "/" && source[i + 1] === "*") { blockCommentDepth = 1; i++; continue; }
    if (ch === "$" && (source.slice(i).match(/^\$[A-Za-z0-9_]*\$/)?.[0])) {
      dollar = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/)![0];
      i += dollar.length - 1;
      continue;
    }
    if (ch === ";") {
      const statement = source.slice(start, i + 1).trim();
      if (statement && !/^--[^\n]*$/.test(statement)) statements.push(statement);
      start = i + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

export function validateAuthoritativeManifest(migrations: readonly AuthoritativeMigration[]): string[] {
  const errors: string[] = [];
  if (migrations.length === 0 || !migrations[0].baseline) errors.push("first authoritative migration must be the baseline");
  if (migrations.filter((row) => row.baseline).length !== 1) errors.push("authoritative history must contain exactly one baseline");
  const ids = new Set<string>();
  for (const row of migrations) {
    if (ids.has(row.id)) errors.push(`duplicate migration id ${row.id}`);
    ids.add(row.id);
    if (!/^[0-9]{4}_[a-z0-9_]+$/.test(row.id)) errors.push(`invalid ordered migration id ${row.id}`);
    if (fileSha256(row.path) !== row.sha256) errors.push(`migration hash drift ${row.id}`);
  }
  return errors;
}

export function migrationPlan(all: readonly AuthoritativeMigration[], appliedIds: readonly string[]) {
  const applied = new Set(appliedIds);
  const unknown = appliedIds.filter((id) => !all.some((row) => row.id === id));
  const pending = all.filter((row) => !applied.has(row.id));
  return { unknown, pending };
}

export const PUBLIC_SCHEMA_FINGERPRINT_SQL = `
SELECT jsonb_build_object(
  'relations', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (
    SELECT jsonb_build_object('name', c.relname, 'kind', c.relkind, 'definition',
      CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid, true) ELSE NULL END) x
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
  ) q), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'table', (x->>'position')::int) FROM (
    SELECT jsonb_build_object('table', table_name, 'position', ordinal_position, 'name', column_name,
      'type', data_type, 'udt', udt_name, 'nullable', is_nullable, 'default', column_default) x
    FROM information_schema.columns WHERE table_schema='public'
  ) q), '[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'table', x->>'name') FROM (
    SELECT jsonb_build_object('table', c.relname, 'name', con.conname, 'type', con.contype,
      'definition', pg_get_constraintdef(con.oid, true)) x
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
  ) q), '[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname, 'definition', indexdef) ORDER BY tablename,indexname)
    FROM pg_indexes WHERE schemaname='public'), '[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid, true)) ORDER BY c.relname,t.tgname)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal), '[]'::jsonb),
  'routines', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', p.proname, 'identity', pg_get_function_identity_arguments(p.oid), 'definition', pg_get_functiondef(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'), '[]'::jsonb)
) AS schema`;

export function publicSchemaFingerprint(schema: unknown): string {
  return createHash("sha256").update(stableStringify(schema)).digest("hex");
}
