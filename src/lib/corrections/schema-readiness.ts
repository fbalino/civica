import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

const REQUIRED_ATL_024_COLUMNS = [
  "entity_type",
  "entity_id",
  "field_path",
  "affected_release_id",
  "reported_source_id",
  "reported_source_url",
  "published_value",
  "proposed_value",
  "evidence_url",
  "notice_version",
  "notice_accepted_at",
  "acknowledgment_code",
  "acknowledged_at",
  "triaged_at",
  "reviewer_id",
] as const;

export async function isAtlasCorrectionSchemaReady(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'correction_log'
        AND column_name IN (${sql.join(
          REQUIRED_ATL_024_COLUMNS.map((column) => sql`${column}`),
          sql`, `,
        )})
    `);
    const rows = ((result as unknown as { rows?: unknown[] }).rows ??
      result) as Array<{ column_name?: unknown }>;
    const columns = new Set(rows.map((row) => String(row.column_name)));
    return REQUIRED_ATL_024_COLUMNS.every((column) => columns.has(column));
  } catch {
    return false;
  }
}
