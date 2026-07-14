import {
  databaseAdminAuditWriter,
  newAdminAuditRequestId,
  writeAdminAuditEvent,
  type AdminAuditWriter,
} from "@/lib/admin/mutation-audit";
import {
  buildAdminClearCookieHeaders,
  getAdminSessionForLogout,
  type AdminSession,
} from "@/lib/admin/session";
import {
  adminSessionKey,
  databaseAdminSessionRevocationStore,
  revokeAdminSession,
  type AdminSessionRevocationStore,
} from "@/lib/admin/session-revocation-store";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";

export interface AdminLogoutDependencies {
  getSession(): Promise<AdminSession | null>;
  revocations: AdminSessionRevocationStore;
  writeAudit: AdminAuditWriter;
  requestId(): string;
  now(): number;
  logError(message: string, error: unknown): void;
}

const productionDependencies: AdminLogoutDependencies = {
  getSession: getAdminSessionForLogout,
  revocations: databaseAdminSessionRevocationStore,
  writeAudit: databaseAdminAuditWriter,
  requestId: newAdminAuditRequestId,
  now: Date.now,
  logError: console.error,
};

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function clearedRedirect(request: Request): Response {
  const headers = new Headers({
    Location: new URL("/admin/sign-in", request.url).toString(),
    "Cache-Control": "no-store",
  });
  for (const [name, value] of buildAdminClearCookieHeaders()) {
    headers.append(name, value);
  }
  return new Response(null, { status: 303, headers });
}

/**
 * Shared idempotent logout boundary. A valid signed cookie is tombstoned
 * before browser cookies are cleared; a revocation-store failure returns 503
 * without claiming success. Missing/expired/malformed cookies are safe to
 * clear after the same-origin guard passes.
 */
export async function runAdminLogout(
  request: Request,
  route: "/api/admin/session" | "/api/admin/sign-out",
  dependencies: AdminLogoutDependencies = productionDependencies,
): Promise<Response> {
  const guard = guardAdminMutationRequest(request);

  let session: AdminSession | null;
  try {
    session = await dependencies.getSession();
  } catch (error) {
    dependencies.logError("[admin-logout] cookie verification failed", error);
    return errorResponse("Admin logout is temporarily unavailable", 503);
  }

  if (!session) {
    return guard.ok ? clearedRedirect(request) : guard.response;
  }

  const requestId = dependencies.requestId();
  const sessionKey = adminSessionKey(session.sessionId);
  const auditBase = {
    requestId,
    route,
    method: request.method as "POST" | "DELETE",
    actorId: session.reviewerId,
    actorSource: "admin_session" as const,
    sessionKey,
    action: "admin_session.logout",
    targetType: "admin_session",
    targetId: sessionKey,
  };

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
        "[admin-logout] denied-request audit failed",
        error,
      );
      return errorResponse("Admin audit is temporarily unavailable", 503);
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
    dependencies.logError("[admin-logout] attempt audit failed", error);
    return errorResponse("Admin audit is temporarily unavailable", 503);
  }

  try {
    await revokeAdminSession(
      session,
      dependencies.now(),
      dependencies.revocations,
    );
  } catch (error) {
    dependencies.logError("[admin-logout] revocation failed", error);
    try {
      await writeAdminAuditEvent(
        {
          ...auditBase,
          event: "outcome",
          result: "failed",
          httpStatus: 503,
          reasonCode: "revocation_store_unavailable",
        },
        dependencies.writeAudit,
      );
    } catch (auditError) {
      dependencies.logError("[admin-logout] failure audit failed", auditError);
    }
    return errorResponse("Admin logout is temporarily unavailable", 503);
  }

  try {
    await writeAdminAuditEvent(
      {
        ...auditBase,
        event: "outcome",
        result: "succeeded",
        httpStatus: 303,
        reasonCode: null,
      },
      dependencies.writeAudit,
    );
  } catch (error) {
    dependencies.logError("[admin-logout] outcome audit failed", error);
    return errorResponse("Admin audit is temporarily unavailable", 503);
  }

  return clearedRedirect(request);
}

export async function withAdminLogout(
  request: Request,
  route: "/api/admin/session" | "/api/admin/sign-out",
): Promise<Response> {
  return runAdminLogout(request, route);
}
