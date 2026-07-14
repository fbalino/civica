import {
  databaseAdminAuditWriter,
  newAdminAuditRequestId,
  writeAdminAuditEvent,
  type AdminAuditDescriptor,
  type AdminAuditResult,
  type AdminAuditWriter,
} from "@/lib/admin/mutation-audit";
import { getAdminSession, type AdminSession } from "@/lib/admin/session";
import { adminSessionKey } from "@/lib/admin/session-revocation-store";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import { unstable_rethrow } from "next/navigation";

export interface AdminMutationDependencies {
  getSession(): Promise<AdminSession | null>;
  writeAudit: AdminAuditWriter;
  requestId(): string;
  logError(message: string, error: unknown): void;
}

const productionDependencies: AdminMutationDependencies = {
  getSession: getAdminSession,
  writeAudit: databaseAdminAuditWriter,
  requestId: newAdminAuditRequestId,
  logError: console.error,
};

export type AdminMutationProblemCode =
  | "ADMIN_AUTH_UNAVAILABLE"
  | "ADMIN_AUDIT_UNAVAILABLE"
  | "ADMIN_MUTATION_FAILED"
  | "UNAUTHORIZED"
  | "DELETION_CONFIRMATION_REQUIRED"
  | "APPLICATION_NOT_FOUND"
  | "INVALID_STATUS"
  | "INVALID_ACTION"
  | "DISPUTE_NOT_FOUND"
  | "DISPUTE_STATE_CONFLICT"
  | "WINNING_FACT_NOT_FOUND"
  | "MESSAGE_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_CURRENT"
  | "EVENT_NOT_PENDING"
  | "INVALID_CLASSIFICATION"
  | "INVALID_EXPIRY"
  | "INVALID_NOTE"
  | "CONFLICT"
  | "INVALID_PARTICIPANT_REQUEST"
  | "AGENT_USE_STATUS_INVALID"
  | "STUDY_NOT_FOUND"
  | "STUDY_EMPTY";

export function adminMutationProblem(
  code: AdminMutationProblemCode,
  message: string,
  status: number,
): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function nonCacheableHandlerError(response: Response): Response {
  if (response.status < 400) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function resultForStatus(
  status: number,
): Exclude<AdminAuditResult, "attempted"> {
  if (status >= 500) return "failed";
  if (status >= 400) return "rejected";
  return "succeeded";
}

/**
 * Shared cookie-only authorization, same-origin CSRF, and audit boundary for
 * every unsafe owner-admin mutation. Bearer headers are intentionally ignored.
 * A durable attempted event is the precondition for business work. The
 * terminal event follows the handler; if that insert is unavailable after a
 * completed mutation, the attempted row deliberately remains as an
 * interrupted-lifecycle signal instead of returning a retry-inducing error.
 */
export async function runAdminMutation(
  request: Request,
  descriptor: AdminAuditDescriptor,
  handler: (session: AdminSession) => Promise<Response>,
  dependencies: AdminMutationDependencies = productionDependencies,
): Promise<Response> {
  let session: AdminSession | null;
  try {
    session = await dependencies.getSession();
  } catch (error) {
    dependencies.logError("[admin-mutation] session store unavailable", error);
    return adminMutationProblem(
      "ADMIN_AUTH_UNAVAILABLE",
      "Admin authorization is temporarily unavailable",
      503,
    );
  }
  if (!session)
    return adminMutationProblem("UNAUTHORIZED", "Unauthorized", 401);

  const requestId = dependencies.requestId();
  const auditBase = {
    ...descriptor,
    requestId,
    method: request.method as "POST" | "PUT" | "PATCH" | "DELETE",
    actorId: session.reviewerId,
    actorSource: "admin_session" as const,
    sessionKey: adminSessionKey(session.sessionId),
  };
  const guard = guardAdminMutationRequest(request);
  if (!guard.ok) {
    try {
      await writeAdminAuditEvent(
        {
          ...auditBase,
          event: "outcome",
          result: "rejected",
          httpStatus: guard.response.status,
          reasonCode: `csrf_${guard.reason}`,
        },
        dependencies.writeAudit,
      );
    } catch (error) {
      dependencies.logError(
        "[admin-mutation] denied-request audit failed",
        error,
      );
      return adminMutationProblem(
        "ADMIN_AUDIT_UNAVAILABLE",
        "Admin audit is temporarily unavailable",
        503,
      );
    }
    return guard.response;
  }

  try {
    await writeAdminAuditEvent(
      {
        ...auditBase,
        event: "attempt",
        result: "attempted",
        httpStatus: null,
        reasonCode: null,
      },
      dependencies.writeAudit,
    );
  } catch (error) {
    dependencies.logError("[admin-mutation] attempt audit failed", error);
    return adminMutationProblem(
      "ADMIN_AUDIT_UNAVAILABLE",
      "Admin audit is temporarily unavailable",
      503,
    );
  }

  let response: Response;
  try {
    response = await handler(session);
  } catch (error) {
    unstable_rethrow(error);
    dependencies.logError("[admin-mutation] handler failed", error);
    try {
      await writeAdminAuditEvent(
        {
          ...auditBase,
          event: "outcome",
          result: "failed",
          httpStatus: 500,
          reasonCode: "handler_exception",
        },
        dependencies.writeAudit,
      );
    } catch (auditError) {
      dependencies.logError(
        "[admin-mutation] failure audit failed",
        auditError,
      );
    }
    return adminMutationProblem(
      "ADMIN_MUTATION_FAILED",
      "Admin mutation failed",
      500,
    );
  }

  try {
    await writeAdminAuditEvent(
      {
        ...auditBase,
        event: "outcome",
        result: resultForStatus(response.status),
        httpStatus: response.status,
        reasonCode: response.status >= 400 ? `http_${response.status}` : null,
      },
      dependencies.writeAudit,
    );
  } catch (error) {
    // The pre-write attempt remains durable and identifies the interrupted
    // audit lifecycle. Do not obscure a mutation that already completed.
    dependencies.logError("[admin-mutation] outcome audit failed", error);
  }
  return nonCacheableHandlerError(response);
}

export async function withAdminMutation(
  request: Request,
  descriptor: AdminAuditDescriptor,
  handler: (session: AdminSession) => Promise<Response>,
): Promise<Response> {
  return runAdminMutation(request, descriptor, handler);
}
