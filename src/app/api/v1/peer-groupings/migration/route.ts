/**
 * GET /api/v1/peer-groupings/migration — per-country migration table.
 *
 * Replication-script maintainers consume this endpoint to bulk-rewrite
 * `structural_family` joins to the new peer-lens fields. Same data
 * the reader-facing migration page renders.
 *
 * Plan: ~/civica/plan/structural-family-removal-implementation-plan.md §B-Phase 4 / §C-Q9
 * Methodology: /civica-index/methodology/peer-grouping
 */

import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getPeerGroupingMigrationTable } from "@/lib/db/queries-peer-grouping";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const rows = await getPeerGroupingMigrationTable();
    return apiResponse({
      data: rows,
      meta: {
        total: rows.length,
        peerGrouping: {
          status: "stable",
          version: "v1.0",
          adopted: "2026-05-02",
          methodology:
            "https://civicaatlas.org/civica-index/methodology/peer-grouping",
          replaces: "structural_family (sunset 2027-03-31)",
        },
        schema: {
          deprecated: ["structuralFamily", "structuralSubtype"],
          replacement: [
            "worldBankRegion",
            "worldBankIncomeGroup",
            "vdemRow",
            "cgvRegime",
            "monarchyStatus",
            "governmentFormDescription",
          ],
        },
      },
    });
  } catch (e) {
    console.error("API /v1/peer-groupings/migration error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
