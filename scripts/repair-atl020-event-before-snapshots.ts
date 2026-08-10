/**
 * ATL-020 event repair — restore the true before/after diff on the two Jersey
 * correction events (CA-587FA00E6DEE) that the pre-fix writer recorded as
 * `insert` with null befores.
 *
 * The writer's `before_row` CTE used `FOR UPDATE`, whose locking scan skips a
 * tuple the same statement's `ON CONFLICT DO UPDATE` already modified, so the
 * public events lost their before snapshot (fixed in
 * `country-fact-history-writer.ts`, proven by
 * `country-fact-history-writer.postgres.test.ts`). Every repaired value comes
 * verbatim from the synchronous `research_evidence_history` retention rows
 * captured by the original mutation — nothing is inferred.
 *
 * Zero-write dry run by default; pass --apply to execute.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const REPAIRS = [
  {
    eventId: "71396231-f04b-495d-b620-734ed2bd8402",
    retentionRowId: "9c657790-efc3-470e-af94-cf1f8a8873ae",
    factId: "82a72936-450c-4f15-80c9-66867bd667ba",
  },
  {
    eventId: "8b0c77ee-6694-4a44-b554-ac674345b5cb",
    retentionRowId: "670b0af9-f444-4fb6-907a-af5feb69f3dd",
    factId: "f6185cf4-599d-48de-a7bc-733dd85f7327",
  },
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const planned: Array<Record<string, unknown>> = [];
  for (const repair of REPAIRS) {
    const [event] = await sql`
      SELECT id, entity_id, operation, changes
      FROM atlas_entity_change_history WHERE id = ${repair.eventId}::uuid`;
    const [retained] = await sql`
      SELECT id, entity_id, operation,
             before->>'fact_value' AS before_value,
             after->>'fact_value' AS after_value
      FROM research_evidence_history WHERE id = ${repair.retentionRowId}::uuid`;
    if (!event || !retained) {
      throw new Error(`Missing event or retention row for ${repair.eventId}`);
    }
    if (
      event.entity_id !== repair.factId ||
      retained.entity_id !== repair.factId ||
      retained.operation !== "update"
    ) {
      throw new Error(`Identity mismatch for ${repair.eventId}`);
    }
    if (event.operation !== "insert") {
      throw new Error(
        `Event ${repair.eventId} is not in the misrecorded insert state (found ${event.operation}); refusing to touch it`,
      );
    }
    const changes = event.changes as Array<{ field: string; before: unknown }>;
    if (!changes.every((change) => change.before === null)) {
      throw new Error(
        `Event ${repair.eventId} already carries before values; refusing to overwrite`,
      );
    }
    if (typeof retained.before_value !== "string" || !retained.after_value) {
      throw new Error(`Retention row ${repair.retentionRowId} lacks fact_value states`);
    }
    planned.push({
      eventId: repair.eventId,
      operation: { from: "insert", to: "update" },
      changes: {
        to: [
          {
            field: "fact_value",
            before: retained.before_value,
            after: retained.after_value,
          },
        ],
      },
      evidenceRetentionRowId: repair.retentionRowId,
    });
  }

  if (!apply) {
    console.log(
      JSON.stringify({ mode: "dry_run", writesPerformed: 0, planned }, null, 2),
    );
    return;
  }

  for (const plan of planned) {
    const changes = (plan.changes as { to: unknown }).to;
    await sql`
      UPDATE atlas_entity_change_history
      SET operation = 'update', changes = ${JSON.stringify(changes)}::jsonb
      WHERE id = ${plan.eventId as string}::uuid AND operation = 'insert'`;
    console.log(`Repaired event ${plan.eventId}`);
  }

  const verify = await sql`
    SELECT id, operation, changes FROM atlas_entity_change_history
    WHERE id IN (${REPAIRS[0].eventId}::uuid, ${REPAIRS[1].eventId}::uuid)`;
  console.log(JSON.stringify(verify, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
