import { createHash } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { cronJobExecutions } from "@/lib/db/schema";

const ALERT_HISTORY_LIMIT = 128;

export interface CronAlertHistoryRow {
  resultCode: string;
  completedAt: Date;
}

export interface CronAlertHistoryStore {
  load(jobId: string, limit?: number): Promise<CronAlertHistoryRow[]>;
}

export type CronAlertEmission = "none" | "open" | "reminder" | "recovered";

export interface CronAlertTransition {
  resultCode: string;
  state: "clear" | "observed" | "open" | "suppressed" | "reminder" | "recovered";
  emission: CronAlertEmission;
  consecutiveAdverseObservations: number;
}

export const postgresCronAlertHistoryStore: CronAlertHistoryStore = {
  async load(jobId, limit = ALERT_HISTORY_LIMIT) {
    const boundedLimit = Math.max(1, Math.min(limit, ALERT_HISTORY_LIMIT));
    const rows = await db
      .select({
        resultCode: cronJobExecutions.resultCode,
        completedAt: cronJobExecutions.completedAt,
      })
      .from(cronJobExecutions)
      .where(eq(cronJobExecutions.jobId, jobId))
      .orderBy(desc(cronJobExecutions.updatedAt))
      .limit(boundedLimit);
    return rows.flatMap((row) =>
      row.resultCode && row.completedAt
        ? [{ resultCode: row.resultCode, completedAt: row.completedAt }]
        : [],
    );
  },
};

export function alertSignature(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of [...parts].sort()) hash.update(part).update("\0");
  return hash.digest("hex").slice(0, 16);
}

function parseAdverseCode(
  namespace: string,
  code: string,
): { signature: string; emitted: boolean } | null {
  const match = new RegExp(
    `^${namespace}_alert_(observed|open|suppressed|reminder)_([a-f0-9]{16})$`,
  ).exec(code);
  return match
    ? {
        signature: match[2],
        emitted: match[1] === "open" || match[1] === "reminder",
      }
    : null;
}

export function cronAlertTransition(input: {
  namespace: "health" | "pipeline";
  now: Date;
  currentSignature: string | null;
  immediate?: boolean;
  requiredConsecutive?: number;
  reminderCooldownMs: number;
  history: readonly CronAlertHistoryRow[];
}): CronAlertTransition {
  const requiredConsecutive = input.requiredConsecutive ?? 2;
  if (
    !Number.isFinite(input.now.getTime()) ||
    !Number.isSafeInteger(requiredConsecutive) ||
    requiredConsecutive < 1 ||
    !Number.isSafeInteger(input.reminderCooldownMs) ||
    input.reminderCooldownMs < 1
  ) {
    throw new Error("Invalid cron alert transition input");
  }

  const alertHistory = input.history.filter((row) =>
    row.resultCode.startsWith(`${input.namespace}_alert_`),
  );
  const latestAlertState = alertHistory[0];
  const latestAdverse = latestAlertState
    ? parseAdverseCode(input.namespace, latestAlertState.resultCode)
    : null;

  let latestIncidentEmission: CronAlertHistoryRow | undefined;
  if (latestAdverse) {
    for (const row of alertHistory) {
      const adverse = parseAdverseCode(input.namespace, row.resultCode);
      if (!adverse || adverse.signature !== latestAdverse.signature) break;
      if (adverse.emitted) {
        latestIncidentEmission = row;
        break;
      }
    }
  }
  let latestEmittedAlert:
    | { row: CronAlertHistoryRow; signature: string }
    | undefined;
  for (const row of alertHistory) {
    const adverse = parseAdverseCode(input.namespace, row.resultCode);
    // A durable clear/recovered transition closes every older incident.
    if (!adverse) break;
    if (adverse.emitted) {
      latestEmittedAlert = { row, signature: adverse.signature };
      break;
    }
  }

  if (!input.currentSignature) {
    if (latestEmittedAlert) {
      return {
        resultCode: `${input.namespace}_alert_recovered_${latestEmittedAlert.signature}`,
        state: "recovered",
        emission: "recovered",
        consecutiveAdverseObservations: 0,
      };
    }
    return {
      resultCode: `${input.namespace}_alert_clear`,
      state: "clear",
      emission: "none",
      consecutiveAdverseObservations: 0,
    };
  }

  let consecutive = 1;
  for (const row of input.history) {
    const adverse = parseAdverseCode(input.namespace, row.resultCode);
    if (!adverse || adverse.signature !== input.currentSignature) break;
    consecutive++;
  }
  const latestEmission =
    latestAdverse?.signature === input.currentSignature
      ? latestIncidentEmission
      : undefined;
  const changedFromEmittedIncident = Boolean(
    latestEmittedAlert &&
      latestEmittedAlert.signature !== input.currentSignature,
  );

  if (
    !latestEmission &&
    (input.immediate ||
      changedFromEmittedIncident ||
      consecutive >= requiredConsecutive)
  ) {
    return {
      resultCode: `${input.namespace}_alert_open_${input.currentSignature}`,
      state: "open",
      emission: "open",
      consecutiveAdverseObservations: consecutive,
    };
  }
  if (
    latestEmission &&
    input.now.getTime() - latestEmission.completedAt.getTime() >=
      input.reminderCooldownMs
  ) {
    return {
      resultCode: `${input.namespace}_alert_reminder_${input.currentSignature}`,
      state: "reminder",
      emission: "reminder",
      consecutiveAdverseObservations: consecutive,
    };
  }
  if (!latestEmission) {
    return {
      resultCode: `${input.namespace}_alert_observed_${input.currentSignature}`,
      state: "observed",
      emission: "none",
      consecutiveAdverseObservations: consecutive,
    };
  }
  return {
    resultCode: `${input.namespace}_alert_suppressed_${input.currentSignature}`,
    state: "suppressed",
    emission: "none",
    consecutiveAdverseObservations: consecutive,
  };
}
