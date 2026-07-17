import assert from "node:assert/strict";
import test from "node:test";

import {
  buildErrorMonitoringEvent,
  errorMonitoringAlerts,
  linkErrorMonitoringKnownIssue,
  recordErrorMonitoringEvent,
  resolveErrorMonitoringEvent,
  type ErrorMonitoringEvent,
  type ErrorMonitoringIssueLink,
  type ErrorMonitoringStore,
} from "./error-monitoring";

class FixtureStore implements ErrorMonitoringStore {
  readonly events = new Map<string, ErrorMonitoringEvent>();
  readonly links: ErrorMonitoringIssueLink[] = [];

  async record(event: ErrorMonitoringEvent): Promise<ErrorMonitoringEvent> {
    const prior = this.events.get(event.fingerprint);
    const recorded: ErrorMonitoringEvent = prior
      ? {
          ...prior,
          lastSeenAt: event.lastSeenAt,
          occurrenceCount: prior.occurrenceCount + 1,
          status: "open",
          resolvedAt: null,
        }
      : { ...event, id: `event-${this.events.size + 1}` };
    this.events.set(recorded.fingerprint, recorded);
    return recorded;
  }

  async resolve(eventId: string, resolvedAt: Date): Promise<boolean> {
    for (const [fingerprint, event] of this.events) {
      if (event.id !== eventId || event.status !== "open") continue;
      this.events.set(fingerprint, { ...event, status: "resolved", resolvedAt });
      return true;
    }
    return false;
  }

  async linkKnownIssue(link: ErrorMonitoringIssueLink): Promise<void> {
    this.links.push(link);
  }

  async pruneBefore(before: Date): Promise<number> {
    let removed = 0;
    for (const [fingerprint, event] of this.events) {
      if (event.lastSeenAt >= before) continue;
      this.events.delete(fingerprint);
      removed += 1;
    }
    return removed;
  }
}

test("all monitored surfaces retain release and only their closed context", () => {
  const releaseId = "abc1234";
  const events = [
    buildErrorMonitoringEvent({
      surface: "server",
      routeId: "api.countries.slug.get",
      errorCode: "route.unhandled",
      releaseId,
    }),
    buildErrorMonitoringEvent({
      surface: "client",
      routeId: "document.country",
      errorCode: "client.route_boundary",
      releaseId,
    }),
    buildErrorMonitoringEvent({
      surface: "cron",
      routeId: "api.cron.factbook.sync-wikidata",
      jobId: "factbook.sync-wikidata",
      errorCode: "cron.handler_exception",
      releaseId,
    }),
    buildErrorMonitoringEvent({
      surface: "script",
      jobId: "atlas.cia-factbook",
      errorCode: "script.child_exit_failure",
      releaseId,
    }),
  ];
  assert.deepEqual(events.map((event) => event.releaseId), [
    releaseId,
    releaseId,
    releaseId,
    releaseId,
  ]);
  assert.ok(
    events.every(
      (event) => event.sourceMapId === `nextjs-protected/${releaseId}`,
    ),
  );
  assert.equal(JSON.stringify(events).includes("postgres://"), false);
  assert.equal(JSON.stringify(events).includes("stack"), false);
});

test("monitoring rejects dynamic or content-bearing identifiers", () => {
  assert.throws(
    () =>
      buildErrorMonitoringEvent({
        surface: "server",
        routeId: "api.countries/ury?email=private@example.test",
        errorCode: "route.unhandled",
      }),
    /context is invalid/,
  );
  assert.throws(
    () =>
      buildErrorMonitoringEvent({
        surface: "script",
        jobId: "atlas.cia-factbook",
        errorCode: "provider password=secret",
      }),
    /error code is invalid/,
  );
});

test("a seeded error appears, links to correction and status records, resolves, and reopens only on recurrence", async () => {
  const store = new FixtureStore();
  const seed = {
    surface: "cron" as const,
    routeId: "api.cron.factbook.sync-wikidata",
    jobId: "factbook.sync-wikidata",
    errorCode: "cron.handler_exception",
    releaseId: "abc1234",
    occurredAt: new Date("2026-07-16T12:00:00.000Z"),
  };
  const appeared = await recordErrorMonitoringEvent(seed, store);
  assert.ok(appeared);
  assert.equal(appeared.status, "open");
  assert.deepEqual(errorMonitoringAlerts([...store.events.values()]), [
    {
      id: "event-1",
      surface: "cron",
      routeId: "api.cron.factbook.sync-wikidata",
      jobId: "factbook.sync-wikidata",
      errorCode: "cron.handler_exception",
      releaseId: "abc1234",
      sourceMapId: "nextjs-protected/abc1234",
      occurrenceCount: 1,
    },
  ]);

  await linkErrorMonitoringKnownIssue(
    { eventId: appeared.id, recordType: "correction", recordId: "a3c58f68-8aa4-475a-bf23-cd4ad583a2be" },
    store,
  );
  await linkErrorMonitoringKnownIssue(
    { eventId: appeared.id, recordType: "status", recordId: "incident-20260716-001" },
    store,
  );
  assert.equal(store.links.length, 2);

  assert.equal(
    await resolveErrorMonitoringEvent(
      appeared.id,
      store,
      new Date("2026-07-16T12:05:00.000Z"),
    ),
    true,
  );
  assert.deepEqual(errorMonitoringAlerts([...store.events.values()]), []);

  const reopened = await recordErrorMonitoringEvent(seed, store);
  assert.ok(reopened);
  assert.equal(reopened.status, "open");
  assert.equal(reopened.occurrenceCount, 2);
  assert.equal(reopened.resolvedAt, null);
});
