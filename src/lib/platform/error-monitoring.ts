import { createHash } from "node:crypto";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  errorMonitoringEvents,
  errorMonitoringIssueLinks,
} from "@/lib/db/schema";
import { deploymentReleaseId } from "@/lib/platform/route-performance-telemetry";

export const ERROR_MONITORING_VERSION =
  "civica-error-monitoring/v1" as const;
export const ERROR_MONITORING_RETENTION_DAYS = 90;
export const ERROR_MONITORING_ALERT_WINDOW_HOURS = 24;

export type ErrorMonitoringSurface = "server" | "client" | "cron" | "script";
export type ErrorMonitoringStatus = "open" | "resolved";
export type KnownIssueRecordType = "correction" | "status";

export interface ErrorMonitoringEvent {
  id: string;
  fingerprint: string;
  surface: ErrorMonitoringSurface;
  routeId: string | null;
  jobId: string | null;
  errorCode: string;
  releaseId: string;
  sourceMapId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  status: ErrorMonitoringStatus;
  resolvedAt: Date | null;
}

export interface ErrorMonitoringEventInput {
  surface: ErrorMonitoringSurface;
  routeId?: string;
  jobId?: string;
  errorCode: string;
  releaseId?: string;
  occurredAt?: Date;
}

export interface ErrorMonitoringIssueLink {
  eventId: string;
  recordType: KnownIssueRecordType;
  recordId: string;
}

export interface ErrorMonitoringStore {
  record(input: ErrorMonitoringEvent): Promise<ErrorMonitoringEvent>;
  resolve(eventId: string, resolvedAt: Date): Promise<boolean>;
  linkKnownIssue(input: ErrorMonitoringIssueLink): Promise<void>;
  pruneBefore(before: Date): Promise<number>;
}

export interface ErrorMonitoringAlert {
  id: string;
  surface: ErrorMonitoringSurface;
  routeId: string | null;
  jobId: string | null;
  errorCode: string;
  releaseId: string;
  sourceMapId: string;
  occurrenceCount: number;
}

const IDENTIFIER = /^[a-z][a-z0-9._-]{0,159}$/;
const JOB_ID = /^[a-z][a-z0-9.-]{0,79}$/;
const ERROR_CODE = /^[a-z][a-z0-9_.-]{0,79}$/;
const RELEASE_ID = /^[A-Za-z0-9._-]{1,96}$/;
const ISSUE_RECORD_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function fingerprint(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}

function normalizeIdentifier(value: string, maxLength: number): string {
  const normalized = value
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[^A-Za-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase()
    .slice(0, maxLength);
  return /^[a-z]/.test(normalized) ? normalized : "unknown";
}

export function monitoringRouteId(operation: string): string {
  return normalizeIdentifier(operation, 160);
}

export function sourceMapIdForRelease(releaseId: string): string {
  if (!RELEASE_ID.test(releaseId)) throw new Error("Invalid monitoring release ID");
  return `nextjs-protected/${releaseId}`;
}

function assertEvent(event: ErrorMonitoringEvent): void {
  if (!/^[a-f0-9]{64}$/.test(event.fingerprint))
    throw new Error("Error monitoring fingerprint is invalid");
  if (!ERROR_CODE.test(event.errorCode))
    throw new Error("Error monitoring error code is invalid");
  if (!RELEASE_ID.test(event.releaseId))
    throw new Error("Error monitoring release ID is invalid");
  if (event.sourceMapId !== sourceMapIdForRelease(event.releaseId))
    throw new Error("Error monitoring source-map identity drifted");
  if (!Number.isSafeInteger(event.occurrenceCount) || event.occurrenceCount < 1)
    throw new Error("Error monitoring occurrence count is invalid");
  if (event.surface === "script") {
    if (event.routeId !== null || !event.jobId || !JOB_ID.test(event.jobId))
      throw new Error("Script monitoring context is invalid");
  } else if (event.surface === "cron") {
    if (!event.routeId || !IDENTIFIER.test(event.routeId) || !event.jobId || !JOB_ID.test(event.jobId))
      throw new Error("Cron monitoring context is invalid");
  } else if (!event.routeId || !IDENTIFIER.test(event.routeId) || event.jobId !== null) {
    throw new Error("Route monitoring context is invalid");
  }
}

export function buildErrorMonitoringEvent(
  input: ErrorMonitoringEventInput,
): ErrorMonitoringEvent {
  const releaseId = input.releaseId ?? deploymentReleaseId();
  const routeId = input.routeId ?? null;
  const jobId = input.jobId ?? null;
  const firstSeenAt = input.occurredAt ?? new Date();
  const event: ErrorMonitoringEvent = {
    id: "pending",
    fingerprint: fingerprint([
      ERROR_MONITORING_VERSION,
      input.surface,
      routeId ?? "",
      jobId ?? "",
      input.errorCode,
      releaseId,
    ]),
    surface: input.surface,
    routeId,
    jobId,
    errorCode: input.errorCode,
    releaseId,
    sourceMapId: sourceMapIdForRelease(releaseId),
    firstSeenAt,
    lastSeenAt: firstSeenAt,
    occurrenceCount: 1,
    status: "open",
    resolvedAt: null,
  };
  assertEvent(event);
  return event;
}

function toEvent(row: typeof errorMonitoringEvents.$inferSelect): ErrorMonitoringEvent {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    surface: row.surface,
    routeId: row.routeId,
    jobId: row.jobId,
    errorCode: row.errorCode,
    releaseId: row.releaseId,
    sourceMapId: row.sourceMapId,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    occurrenceCount: row.occurrenceCount,
    status: row.status,
    resolvedAt: row.resolvedAt,
  };
}

export const postgresErrorMonitoringStore: ErrorMonitoringStore = {
  async record(event) {
    assertEvent(event);
    const [recorded] = await db
      .insert(errorMonitoringEvents)
      .values({
        fingerprint: event.fingerprint,
        surface: event.surface,
        routeId: event.routeId,
        jobId: event.jobId,
        errorCode: event.errorCode,
        releaseId: event.releaseId,
        sourceMapId: event.sourceMapId,
        firstSeenAt: event.firstSeenAt,
        lastSeenAt: event.lastSeenAt,
        occurrenceCount: event.occurrenceCount,
        status: "open",
        resolvedAt: null,
        monitoringVersion: ERROR_MONITORING_VERSION,
      })
      .onConflictDoUpdate({
        target: errorMonitoringEvents.fingerprint,
        set: {
          lastSeenAt: event.lastSeenAt,
          occurrenceCount: sql`${errorMonitoringEvents.occurrenceCount} + 1`,
          status: "open",
          resolvedAt: null,
        },
      })
      .returning();
    if (!recorded) throw new Error("Error monitoring event was not retained");
    return toEvent(recorded);
  },
  async resolve(eventId, resolvedAt) {
    const rows = await db
      .update(errorMonitoringEvents)
      .set({ status: "resolved", resolvedAt })
      .where(and(eq(errorMonitoringEvents.id, eventId), eq(errorMonitoringEvents.status, "open")))
      .returning({ id: errorMonitoringEvents.id });
    return rows.length === 1;
  },
  async linkKnownIssue(input) {
    if (!ISSUE_RECORD_ID.test(input.recordId))
      throw new Error("Known-issue record ID is invalid");
    await db
      .insert(errorMonitoringIssueLinks)
      .values(input)
      .onConflictDoNothing();
  },
  async pruneBefore(before) {
    const rows = await db
      .delete(errorMonitoringEvents)
      .where(sql`${errorMonitoringEvents.lastSeenAt} < ${before}`)
      .returning({ id: errorMonitoringEvents.id });
    return rows.length;
  },
};

/**
 * Monitoring must not turn a request, cron job, or script failure into a
 * second failure. The only fallback log is a fixed label with no exception
 * object, message, path, digest, or request metadata.
 */
export async function recordErrorMonitoringEvent(
  input: ErrorMonitoringEventInput,
  store: ErrorMonitoringStore = postgresErrorMonitoringStore,
): Promise<ErrorMonitoringEvent | null> {
  try {
    return await store.record(buildErrorMonitoringEvent(input));
  } catch {
    console.error("[error-monitoring] record_failed");
    return null;
  }
}

export async function resolveErrorMonitoringEvent(
  eventId: string,
  store: ErrorMonitoringStore = postgresErrorMonitoringStore,
  resolvedAt = new Date(),
): Promise<boolean> {
  return store.resolve(eventId, resolvedAt);
}

export async function linkErrorMonitoringKnownIssue(
  input: ErrorMonitoringIssueLink,
  store: ErrorMonitoringStore = postgresErrorMonitoringStore,
): Promise<void> {
  await store.linkKnownIssue(input);
}

export function errorMonitoringAlerts(
  events: readonly ErrorMonitoringEvent[],
): ErrorMonitoringAlert[] {
  return events
    .filter((event) => event.status === "open")
    .map((event) => ({
      id: event.id,
      surface: event.surface,
      routeId: event.routeId,
      jobId: event.jobId,
      errorCode: event.errorCode,
      releaseId: event.releaseId,
      sourceMapId: event.sourceMapId,
      occurrenceCount: event.occurrenceCount,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function loadErrorMonitoringAlerts(
  now = new Date(),
): Promise<ErrorMonitoringEvent[]> {
  const since = new Date(
    now.getTime() - ERROR_MONITORING_ALERT_WINDOW_HOURS * 60 * 60 * 1_000,
  );
  const rows = await db
    .select()
    .from(errorMonitoringEvents)
    .where(
      and(
        eq(errorMonitoringEvents.status, "open"),
        gte(errorMonitoringEvents.lastSeenAt, since),
      ),
    )
    .orderBy(desc(errorMonitoringEvents.lastSeenAt));
  return rows.map(toEvent);
}

export async function pruneErrorMonitoringEvents(
  store: ErrorMonitoringStore = postgresErrorMonitoringStore,
  now = new Date(),
): Promise<number> {
  return store.pruneBefore(
    new Date(now.getTime() - ERROR_MONITORING_RETENTION_DAYS * 24 * 60 * 60 * 1_000),
  );
}
