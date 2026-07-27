import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  PULSE_REVIEW_COMPLIANCE_STATES,
  PULSE_REVIEW_HEALTH_STATES,
  PULSE_REVIEW_OBLIGATION_STATES,
  PULSE_REVIEW_PRIORITY_BY_SEVERITY,
  PULSE_REVIEW_SLA_TARGETS,
  PULSE_REVIEW_SLA_VERSION,
} from "../src/lib/pulse/v2/review-sla";
import { loadPulseReviewSlaReport } from "../src/lib/pulse/v2/review-sla-store";

config({ path: ".env.local", override: true });

function fail(message: string): never {
  throw new Error(`PUL-033 review-SLA validation failed: ${message}`);
}

const files = {
  schema: readFileSync("src/lib/db/schema.ts", "utf8"),
  migration: readFileSync(
    "drizzle/authoritative/0025_careful_the_professor.sql",
    "utf8",
  ),
  queue: readFileSync("src/lib/db/queries-pulse-review.ts", "utf8"),
  dashboard: readFileSync(
    "src/app/(admin)/admin/pulse-review/page.tsx",
    "utf8",
  ),
  detail: readFileSync(
    "src/app/(admin)/admin/pulse-review/[id]/page.tsx",
    "utf8",
  ),
  decisionRoute: readFileSync(
    "src/app/api/admin/pulse-review/[id]/route.ts",
    "utf8",
  ),
  exceptionRoute: readFileSync(
    "src/app/api/admin/pulse-review/[id]/exception/route.ts",
    "utf8",
  ),
  monitor: readFileSync(
    "src/app/api/cron/pulse/v2/review-sla/route.ts",
    "utf8",
  ),
  vercel: readFileSync("vercel.json", "utf8"),
  methodology: readFileSync("content/methodology-pulse.md", "utf8"),
  changelog: readFileSync(
    "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
    "utf8",
  ),
  apiSchemas: readFileSync("src/lib/api/contract/schemas.ts", "utf8"),
  publicationOrigin: readFileSync(
    "src/lib/pulse/v2/review-validation.ts",
    "utf8",
  ),
  eventCard: readFileSync(
    "src/components/pulse/PulseEventDetailCard.tsx",
    "utf8",
  ),
  reportStore: readFileSync(
    "src/lib/pulse/v2/review-sla-store.ts",
    "utf8",
  ),
};

for (const relation of [
  "pulse_review_obligations",
  "pulse_review_sla_events",
]) {
  if (!files.schema.includes(`\"${relation}\"`))
    fail(`schema is missing ${relation}`);
  if (!files.migration.includes(relation))
    fail(`migration is missing ${relation}`);
}
for (const marker of [
  "pre_contract_unreviewed_backlog",
  "legacy_quarantined",
  "pulse_review_obligation_sync",
  "pulse_review_sla_events_append_only",
  "dat_016_retain_mutation",
  "civica-affected-relations",
]) {
  if (!files.migration.includes(marker)) fail(`migration is missing ${marker}`);
}
if (Object.keys(PULSE_REVIEW_PRIORITY_BY_SEVERITY).length !== 7) {
  fail("not every production severity tier has one priority");
}
if (
  PULSE_REVIEW_SLA_TARGETS.critical.dueAfterMs >=
    PULSE_REVIEW_SLA_TARGETS.urgent.dueAfterMs ||
  PULSE_REVIEW_SLA_TARGETS.urgent.dueAfterMs >=
    PULSE_REVIEW_SLA_TARGETS.standard.dueAfterMs
) {
  fail("severity deadlines are not strictly ordered");
}
if (
  PULSE_REVIEW_OBLIGATION_STATES.length !== 4 ||
  PULSE_REVIEW_COMPLIANCE_STATES.length !== 7 ||
  PULSE_REVIEW_HEALTH_STATES.length !== 4
) {
  fail("closed SLA state sets drifted");
}
for (const marker of [
  "o.due_at ASC",
  "o.queued_at ASC",
  "breached_unexcepted",
  "exception_active",
]) {
  if (!files.queue.includes(marker)) fail(`queue is missing ${marker}`);
}
for (const marker of [
  "Review service level",
  "past deadline",
  "legacy quarantined",
  "dailyCompletenessEligible",
]) {
  if (!files.dashboard.includes(marker)) fail(`dashboard is missing ${marker}`);
}
if (
  !files.detail.includes("Record exception") ||
  !files.exceptionRoute.includes("grantPulseReviewException")
) {
  fail("authenticated bounded-exception workflow is incomplete");
}
for (const marker of [
  'eq(pulseEventsV2.reviewStatus, "pending")',
  "eq(pulseEventsV2.published, false)",
  "event is no longer pending human review",
]) {
  if (!files.decisionRoute.includes(marker))
    fail(`review CAS is missing ${marker}`);
}
if (
  !files.monitor.includes("recordDuePulseReviewEscalations") ||
  !files.monitor.includes("dailyCompletenessEligible: false") ||
  !files.vercel.includes("/api/cron/pulse/v2/review-sla")
) {
  fail("scheduled fail-closed monitor is incomplete");
}
for (const marker of [
  `{{ctx.reviewSlaVersion}}`,
  "bounded exceptions",
  "legacy quarantine",
]) {
  if (!files.methodology.includes(marker))
    fail(`methodology is missing ${marker}`);
}
if (
  !files.changelog.includes("reviewCompletenessNote") ||
  !files.changelog.includes("daily completeness is not assessable")
) {
  fail("public changelog does not fail closed on review-health loss");
}
if (
  !files.apiSchemas.includes('"legacy_quarantined"') ||
  !files.apiSchemas.includes("reviewServiceLevel: z.unknown()") ||
  !files.publicationOrigin.includes('return "legacy_quarantined"') ||
  !files.eventCard.includes("Legacy quarantine · not reviewed")
) {
  fail("API and reader presentation do not keep legacy quarantine distinct from review");
}
if (!files.reportStore.includes("${now}::timestamp + interval '24 hours'")) {
  fail("review report does not type its due-within-24-hours timestamp boundary");
}

async function validateLive() {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [summary, duplicates, invalidLegacy, invalidExceptions, missingAlerts] =
    await Promise.all([
      sql`SELECT
        count(*) FILTER (WHERE o.state IN ('open','claimed'))::int AS active,
        count(*) FILTER (WHERE o.state = 'legacy_quarantined')::int AS legacy,
        count(*) FILTER (WHERE o.state IN ('open','claimed') AND o.due_at <= now())::int AS breached,
        min(o.queued_at) FILTER (WHERE o.state IN ('open','claimed')) AS oldest
      FROM pulse_review_obligations o
      WHERE o.sla_version = ${PULSE_REVIEW_SLA_VERSION}`,
      sql`SELECT count(*)::int AS n FROM (
        SELECT o.incident_id
        FROM pulse_review_obligations o
        WHERE o.sla_version = ${PULSE_REVIEW_SLA_VERSION}
          AND o.state IN ('open','claimed')
        GROUP BY o.incident_id HAVING count(*) > 1
      ) duplicate`,
      sql`SELECT count(*)::int AS n
        FROM pulse_review_obligations o
        JOIN pulse_events_v2 p ON p.id = o.event_id
        WHERE o.state = 'legacy_quarantined'
          AND (p.review_status <> 'legacy_quarantined'
            OR p.published = true OR p.human_reviewed = true
            OR o.disposition <> 'pre_contract_unreviewed_backlog')`,
      sql`SELECT count(*)::int AS n
        FROM pulse_review_sla_events e
        JOIN pulse_review_obligations o ON o.id = e.obligation_id
        WHERE e.kind = 'exception_granted'
          AND (e.expires_at <= e.effective_at
            OR o.state IN ('dispositioned','legacy_quarantined'))`,
      sql`SELECT count(*)::int AS n
        FROM pulse_review_obligations o
        WHERE o.sla_version = ${PULSE_REVIEW_SLA_VERSION}
          AND o.state IN ('open','claimed')
          AND o.escalate_at <= now()
          AND NOT EXISTS (
            SELECT 1 FROM pulse_review_sla_events e
            WHERE e.obligation_id = o.id AND e.kind = 'escalated'
          )`,
    ]);
  if (Number(duplicates[0]?.n) !== 0)
    fail("live active queue duplicates an incident");
  if (Number(invalidLegacy[0]?.n) !== 0)
    fail("legacy quarantine has a false review/publication state");
  if (Number(invalidExceptions[0]?.n) !== 0)
    fail("live exception ledger has an invalid row");
  if (Number(missingAlerts[0]?.n) !== 0)
    fail("an escalated item has no persisted alert");
  const report = await loadPulseReviewSlaReport();
  if (
    report.active !== Number(summary[0]?.active) ||
    report.legacyQuarantined !== Number(summary[0]?.legacy)
  ) {
    fail("live report disagrees with the direct obligation census");
  }
  console.log(
    `Live queue: ${summary[0]?.active} active; ${summary[0]?.legacy} legacy quarantined; ` +
      `${summary[0]?.breached} breached; oldest=${summary[0]?.oldest ?? "none"}.`,
  );
}

async function main() {
  if (process.argv.includes("--live")) await validateLive();
  console.log(
    `PASS — ${PULSE_REVIEW_SLA_VERSION} closes priority deadlines, legacy quarantine, ` +
      "bounded exceptions, persistent escalation, queue observability, and completeness shutoff.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
