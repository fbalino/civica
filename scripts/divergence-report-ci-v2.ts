/**
 * Phase 5.2 — v1.0 vs Beta divergence report.
 *
 * Per the plan: list every country whose Beta score differs from v1.0
 * by more than ±15 points. These get human review before the Phase
 * 5.4 UI cut-over so any surprising movements can be sanity-checked.
 *
 * Smaller deltas are listed in summary form. Skipped countries (Beta
 * couldn't compute due to missing mandatory dimensions) are listed at
 * the end.
 *
 * Usage:
 *   tsx scripts/divergence-report-ci-v2.ts                   # latest quarter
 *   tsx scripts/divergence-report-ci-v2.ts 2023-Q4
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const quarter = process.argv[2] ?? "2023-Q4";
  console.log(`\n=== Divergence report: v1.0 → Beta · ${quarter} ===\n`);

  // Side-by-side comparison.
  const rows = await sql`
    SELECT j.name AS country, j.iso3,
           v1.score::numeric AS v1_score,
           v1.rank AS v1_rank,
           v2.score::numeric AS v2_score,
           v2.score_lower AS v2_lower,
           v2.score_upper AS v2_upper,
           v2.completeness_flag AS v2_completeness,
           v2.rank AS v2_rank
    FROM jurisdictions j
    LEFT JOIN ci_composite_scores v1
      ON v1.jurisdiction_id = j.id
     AND v1.methodology_version = 'v1.0'
     AND v1.quarter = ${quarter}
    LEFT JOIN ci_composite_scores v2
      ON v2.jurisdiction_id = j.id
     AND v2.methodology_version = 'beta'
     AND v2.quarter = ${quarter}
    WHERE v1.score IS NOT NULL OR v2.score IS NOT NULL
    ORDER BY j.name
  `;

  type Row = {
    country: string;
    iso3: string | null;
    v1_score: number | null;
    v1_rank: number | null;
    v2_score: number | null;
    v2_lower: number | null;
    v2_upper: number | null;
    v2_completeness: string | null;
    v2_rank: number | null;
  };

  const both: Array<Row & { delta: number }> = [];
  const v1Only: Row[] = [];
  const v2Only: Row[] = [];
  for (const r of rows as Row[]) {
    const v1 = r.v1_score == null ? null : Number(r.v1_score);
    const v2 = r.v2_score == null ? null : Number(r.v2_score);
    if (v1 != null && v2 != null) {
      both.push({ ...r, delta: v2 - v1 });
    } else if (v1 != null) {
      v1Only.push(r);
    } else if (v2 != null) {
      v2Only.push(r);
    }
  }

  // Big deltas (>±15 points) — flagged for human review.
  const bigDeltas = both
    .filter((r) => Math.abs(r.delta) > 15)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log(`Countries scored under both methodologies: ${both.length}`);
  console.log(`Big deltas (|Δ| > 15 points):              ${bigDeltas.length}\n`);

  if (bigDeltas.length > 0) {
    console.log("FLAGGED FOR REVIEW (sorted by |Δ|):");
    console.log(
      "  " +
        "Country".padEnd(28) +
        "v1.0  →  Beta    Δ      Input-variation range",
    );
    for (const r of bigDeltas) {
      const v1 = r.v1_score == null ? "—" : Number(r.v1_score).toFixed(1);
      const v2 = r.v2_score ?? 0;
      const deltaStr = (r.delta >= 0 ? "+" : "") + r.delta.toFixed(0);
      const ci = `(${r.v2_lower}–${r.v2_upper})`;
      console.log(
        `  ${r.country.padEnd(28)}${String(v1).padStart(5)} → ${String(v2).padStart(3)}   ${deltaStr.padStart(5)}   ${ci}`,
      );
    }
    console.log();
  }

  // Summary stats on smaller deltas.
  const smallDeltas = both.filter((r) => Math.abs(r.delta) <= 15);
  if (smallDeltas.length > 0) {
    const meanAbs =
      smallDeltas.reduce((s, r) => s + Math.abs(r.delta), 0) /
      smallDeltas.length;
    const maxSmall = Math.max(...smallDeltas.map((r) => Math.abs(r.delta)));
    console.log(`Within ±15 points: ${smallDeltas.length} countries`);
    console.log(`  Mean |Δ|:  ${meanAbs.toFixed(1)}`);
    console.log(`  Max |Δ|:   ${maxSmall.toFixed(0)}\n`);
  }

  // Skipped countries — Beta couldn't compute.
  if (v1Only.length > 0) {
    console.log(
      `\nv1.0 scored, Beta skipped (insufficient mandatory dims): ${v1Only.length}`,
    );
    for (const r of v1Only) {
      console.log(`  ${r.country.padEnd(28)} v1=${r.v1_score}`);
    }
  }

  // New countries the Beta picked up that v1 didn't.
  if (v2Only.length > 0) {
    console.log(
      `\nBeta scored, v1.0 skipped (was insufficient under v1 rules): ${v2Only.length}`,
    );
    for (const r of v2Only) {
      console.log(
        `  ${r.country.padEnd(28)} Beta=${r.v2_score} · ${r.v2_completeness}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Divergence report failed:", err);
  process.exit(1);
});
