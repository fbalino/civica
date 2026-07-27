import {
  linkErrorMonitoringKnownIssue,
  resolveErrorMonitoringEvent,
  type KnownIssueRecordType,
} from "../src/lib/platform/error-monitoring";

function usage(): never {
  console.error(
    "Usage: tsx scripts/manage-error-monitoring.ts --event=<uuid> [--link=correction:<record-id>|status:<record-id>] [--resolve]",
  );
  process.exit(2);
}

function option(name: string): string | null {
  const value = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return value ? value.slice(name.length + 3) : null;
}

async function main() {
  const eventId = option("event");
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) usage();
  const rawLink = option("link");
  const resolve = process.argv.slice(2).includes("--resolve");
  if (!rawLink && !resolve) usage();

  if (rawLink) {
    const divider = rawLink.indexOf(":");
    const recordType = rawLink.slice(0, divider) as KnownIssueRecordType;
    const recordId = rawLink.slice(divider + 1);
    if (
      divider < 1 ||
      (recordType !== "correction" && recordType !== "status") ||
      !recordId
    ) {
      usage();
    }
    await linkErrorMonitoringKnownIssue({ eventId, recordType, recordId });
  }
  const resolved = resolve ? await resolveErrorMonitoringEvent(eventId) : false;
  console.log(
    JSON.stringify({
      contract: "civica-error-monitoring-management/v1",
      eventId,
      linked: rawLink !== null,
      resolved,
    }),
  );
}

main().catch(() => {
  console.error("[error-monitoring] management_failed");
  process.exit(1);
});
