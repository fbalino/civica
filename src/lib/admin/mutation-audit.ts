import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { adminMutationAuditLog } from "@/lib/db/schema";
import type { AdminSession } from "./session";
import { adminSessionKey } from "./session-revocation-store";

const SESSION_KEY_PATTERN = /^[a-f0-9]{64}$/;
const DESCRIPTOR_PATTERN = /^[a-z][a-z0-9_.-]*$/;
const REASON_PATTERN = /^[a-z][a-z0-9_.-]*$/;
const ACTOR_PATTERN = /^[a-zA-Z0-9 _.\-]+$/;

export type AdminAuditEventKind = "attempt" | "outcome";
export type AdminAuditResult =
  "attempted" | "succeeded" | "rejected" | "failed";
export type AdminAuditActorSource =
  "admin_session" | "password_login" | "google_login";

export interface AdminAuditDescriptor {
  route: string;
  action: string;
  targetType: string;
  targetId: string;
}

export interface AdminAuditEvent extends AdminAuditDescriptor {
  requestId: string;
  event: AdminAuditEventKind;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  actorId: string;
  actorSource: AdminAuditActorSource;
  sessionKey: string;
  result: AdminAuditResult;
  httpStatus: number | null;
  reasonCode: string | null;
}

export type AdminAuditWriter = (event: AdminAuditEvent) => Promise<void>;

export const databaseAdminAuditWriter: AdminAuditWriter = async (event) => {
  await db.insert(adminMutationAuditLog).values(event);
};

export function newAdminAuditRequestId(): string {
  return randomUUID();
}

function requireBounded(
  label: string,
  value: string,
  maxLength: number,
): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new Error(`Invalid admin audit ${label}`);
  }
  return normalized;
}

/**
 * Validate and write one bounded, credential-free audit event. Callers supply
 * route templates and action names, never request bodies, tokens, or errors.
 */
export async function writeAdminAuditEvent(
  event: AdminAuditEvent,
  writer: AdminAuditWriter = databaseAdminAuditWriter,
): Promise<void> {
  const route = requireBounded("route", event.route, 160);
  const action = requireBounded("action", event.action, 80);
  const targetType = requireBounded("target type", event.targetType, 80);
  const targetId = requireBounded("target id", event.targetId, 160);
  const actorId = requireBounded("actor", event.actorId, 80);

  if (!route.startsWith("/")) throw new Error("Invalid admin audit route");
  if (!DESCRIPTOR_PATTERN.test(action))
    throw new Error("Invalid admin audit action");
  if (!DESCRIPTOR_PATTERN.test(targetType))
    throw new Error("Invalid admin audit target type");
  if (!ACTOR_PATTERN.test(actorId))
    throw new Error("Invalid admin audit actor");
  if (!SESSION_KEY_PATTERN.test(event.sessionKey))
    throw new Error("Invalid admin audit session key");
  if (
    event.reasonCode !== null &&
    (!REASON_PATTERN.test(event.reasonCode) || event.reasonCode.length > 80)
  ) {
    throw new Error("Invalid admin audit reason code");
  }
  if (
    (event.event === "attempt" &&
      (event.result !== "attempted" || event.httpStatus !== null)) ||
    (event.event === "outcome" &&
      (event.result === "attempted" ||
        event.httpStatus === null ||
        !Number.isInteger(event.httpStatus) ||
        event.httpStatus < 100 ||
        event.httpStatus > 599))
  ) {
    throw new Error("Invalid admin audit event/result combination");
  }

  await writer({
    ...event,
    route,
    action,
    targetType,
    targetId,
    actorId,
  });
}

/** Record successful cookie issuance before the response exposes the cookie. */
export async function recordAdminLoginAudit(
  input: {
    session: AdminSession;
    route: "/api/admin/session" | "/api/admin/google/callback";
    actorSource: "password_login" | "google_login";
  },
  writer: AdminAuditWriter = databaseAdminAuditWriter,
): Promise<void> {
  const sessionKey = adminSessionKey(input.session.sessionId);
  await writeAdminAuditEvent(
    {
      requestId: newAdminAuditRequestId(),
      event: "outcome",
      route: input.route,
      method: input.actorSource === "google_login" ? "GET" : "POST",
      actorId: input.session.reviewerId,
      actorSource: input.actorSource,
      sessionKey,
      action: "admin_session.login",
      targetType: "admin_session",
      targetId: sessionKey,
      result: "succeeded",
      httpStatus: 303,
      reasonCode: null,
    },
    writer,
  );
}
