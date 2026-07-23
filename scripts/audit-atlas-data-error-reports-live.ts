import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'correction_log'
  `;
  const names = new Set(columns.map((row) => String(row.column_name)));
  const schemaReady = names.has("acknowledgment_code");
  const legacy = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE status NOT IN (
          'open','in_review','resolved_corrected','resolved_no_change','rejected'
        )
      )::int AS invalid_status,
      COUNT(*) FILTER (
        WHERE (
          status IN ('open','in_review') AND resolved_at IS NOT NULL
        ) OR (
          status IN ('resolved_corrected','resolved_no_change','rejected')
          AND (
            resolved_at IS NULL
            OR disposition IS NULL
            OR length(trim(disposition)) < 10
          )
        )
      )::int AS invalid_resolution_shape,
      COUNT(*) FILTER (WHERE category = 'atlas_data_error')::int
        AS atlas_reports
    FROM correction_log
  `;
  const row = legacy[0] as {
    total: number;
    invalid_status: number;
    invalid_resolution_shape: number;
    atlas_reports: number;
  };
  const result = {
    schemaVersion: "civica-atlas-data-error-report-live-audit/v1",
    capturedAt: new Date().toISOString(),
    mode: "zero_write",
    schemaReady,
    correctionRows: Number(row.total),
    invalidStatusRows: Number(row.invalid_status),
    invalidResolutionShapeRows: Number(row.invalid_resolution_shape),
    atlasReportRows: Number(row.atlas_reports),
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.invalidStatusRows || result.invalidResolutionShapeRows) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
