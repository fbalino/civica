import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  deriveStoredEnsemble,
  storedRunsPermitAutomaticPublication,
} from "../src/lib/pulse/v2/stored-ensemble";
import type { ClassifierRun } from "../src/lib/pulse/v2/types";

// civica-affected-relations: pulse_events_v2,research_evidence_history

config({ path: ".env.local", override: true });

type Row = {
  id: string;
  classifier_agreement: string;
  classifier_runs: ClassifierRun[];
  published: boolean;
  human_reviewed: boolean;
  review_status: string;
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const apply = process.argv.includes("--apply");
  if (apply && process.env.PULSE_APPLY_AGREEMENT_REPAIR !== "yes") {
    throw new Error(
      "Set PULSE_APPLY_AGREEMENT_REPAIR=yes to apply the reviewed repair.",
    );
  }
  const sql = neon(process.env.DATABASE_URL);
  const rows = (await sql.query(
    `SELECT id, classifier_agreement, classifier_runs, published,
            human_reviewed, review_status
       FROM pulse_events_v2 ORDER BY id`,
    [],
  )) as Row[];

  const plans = rows.map((row) => {
    const derived = deriveStoredEnsemble(row.classifier_runs);
    const agreement = derived.consensus.agreement;
    const demoteAutomatic =
      row.published &&
      !row.human_reviewed &&
      !storedRunsPermitAutomaticPublication(row.classifier_runs);
    return {
      row,
      derived,
      agreement,
      demoteAutomatic,
      changes:
        row.classifier_agreement !== agreement || demoteAutomatic,
    };
  });
  const changed = plans.filter((plan) => plan.changes);
  const summary = {
    mode: apply ? "apply" : "dry-run",
    rowsExamined: rows.length,
    rowsChanged: changed.length,
    agreementsCleared: changed.filter(
      ({ row, agreement }) => row.classifier_agreement !== agreement,
    ).length,
    automaticRowsQuarantined: changed.filter(
      ({ demoteAutomatic }) => demoteAutomatic,
    ).length,
    humanPublishedPreserved: plans.filter(
      ({ row }) => row.published && row.human_reviewed,
    ).length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply || changed.length === 0) return;

  const queries = [
    sql`SELECT set_config('civica.change_reason', 'PUL-036 recomputed agreement from stored provider-distinct prompt-versioned classify runs and quarantined unsupported automatic publication.', true)`,
    sql`SELECT set_config('civica.change_actor', 'pul-036-agreement-repair', true)`,
    ...changed.map(({ row, agreement, demoteAutomatic }) => sql`
      UPDATE pulse_events_v2
      SET classifier_agreement = ${agreement},
          published = CASE WHEN ${demoteAutomatic} THEN false ELSE published END,
          review_status = CASE
            WHEN ${demoteAutomatic} THEN 'legacy_quarantined'
            ELSE review_status
          END,
          publication_run_id = CASE
            WHEN ${demoteAutomatic} THEN NULL
            ELSE publication_run_id
          END,
          updated_at = now()
      WHERE id = ${row.id}
    `),
  ];
  await sql.transaction(queries);
  console.log(`Applied ${changed.length} evidence-retained projection repair(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
