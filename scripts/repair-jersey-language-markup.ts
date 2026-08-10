/**
 * ATL-024 correction CA-587FA00E6DEE — strip literal `<p>…</p>` markup from the
 * two Jersey language facts whose frozen CIA Factbook import stored the
 * upstream JSON's embedded HTML verbatim in the plain-text canonical value.
 *
 * The write routes through the atomic ATL-020 country-fact history boundary
 * (`upsertCountryFactWithHistory`) as a `correction` linked to the retained
 * correction-log report, so the public change event and the data change commit
 * in one statement. Frozen vintage rows are immutable and are not touched.
 *
 * Zero-write dry run by default; pass --apply to execute.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const CORRECTION_LOG_ID = "1953f3e9-2014-4707-b67a-0ed9ecad4ef0";
const RELEASE_ID = "atlas-corrections-20260809-v1";
const METHODOLOGY_VERSION = "fact-reconciliation/v0.2-beta";
const REASON =
  "Correction CA-587FA00E6DEE: the frozen CIA Factbook import stored upstream embedded HTML verbatim, so the published plain-text value carried literal <p></p> markup; the markup is stripped and the publisher's language text and (2001 est.) note are preserved.";

const TARGETS = [
  {
    factId: "82a72936-450c-4f15-80c9-66867bd667ba",
    factKey: "official_languages",
  },
  {
    factId: "f6185cf4-599d-48de-a7bc-733dd85f7327",
    factKey: "languages",
  },
] as const;

const DEFECTIVE_VALUE =
  "<p>English (official) 94.5%, Portuguese 4.6%, other 0.9% (includes French (official) and Jerriais)</p> (2001 est.)";
const CORRECTED_VALUE =
  "English (official) 94.5%, Portuguese 4.6%, other 0.9% (includes French (official) and Jerriais) (2001 est.)";

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("@/lib/db");
  const { countryFacts, correctionLog, atlasEntityChangeHistory } =
    await import("@/lib/db/schema");
  const { upsertCountryFactWithHistory } = await import(
    "@/lib/factbook/country-fact-history-writer"
  );
  const { eq, inArray } = await import("drizzle-orm");

  const reports = await db
    .select({ id: correctionLog.id, status: correctionLog.status })
    .from(correctionLog)
    .where(eq(correctionLog.id, CORRECTION_LOG_ID));
  if (reports[0]?.status !== "in_review") {
    throw new Error(
      `Correction ${CORRECTION_LOG_ID} must be in_review before the linked write; found ${reports[0]?.status ?? "missing"}`,
    );
  }

  const rows = await db
    .select()
    .from(countryFacts)
    .where(
      inArray(
        countryFacts.id,
        TARGETS.map((target) => target.factId),
      ),
    );
  if (rows.length !== TARGETS.length) {
    throw new Error(`Expected ${TARGETS.length} target facts, found ${rows.length}`);
  }

  for (const target of TARGETS) {
    const row = rows.find((candidate) => candidate.id === target.factId);
    if (!row || row.factKey !== target.factKey || row.status !== "active") {
      throw new Error(`Target fact ${target.factId} is not the expected active ${target.factKey} row`);
    }
    if (row.factValue !== DEFECTIVE_VALUE) {
      throw new Error(
        `Precondition failed for ${target.factKey}: live value does not match the reported defective value exactly`,
      );
    }
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry_run",
          writesPerformed: 0,
          correctionLogId: CORRECTION_LOG_ID,
          releaseId: RELEASE_ID,
          targets: TARGETS.map((target) => ({
            ...target,
            before: DEFECTIVE_VALUE,
            after: CORRECTED_VALUE,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const target of TARGETS) {
    const row = rows.find((candidate) => candidate.id === target.factId)!;
    await upsertCountryFactWithHistory(db, {
      values: {
        ...row,
        factValue: CORRECTED_VALUE,
      },
      history: {
        changeKind: "correction",
        reason: REASON,
        methodologyVersion: METHODOLOGY_VERSION,
        releaseId: RELEASE_ID,
        correctionLogId: CORRECTION_LOG_ID,
        correctionStatus: "in_review",
      },
    });
    console.log(`Corrected ${target.factKey} (${target.factId})`);
  }

  const events = await db
    .select({
      id: atlasEntityChangeHistory.id,
      entityId: atlasEntityChangeHistory.entityId,
      changeKind: atlasEntityChangeHistory.changeKind,
    })
    .from(atlasEntityChangeHistory)
    .where(eq(atlasEntityChangeHistory.correctionLogId, CORRECTION_LOG_ID));
  console.log(JSON.stringify({ linkedHistoryEvents: events }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
