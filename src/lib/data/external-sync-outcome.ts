export interface ExternalSyncOutcome {
  totalWritten: number;
  errors: readonly string[];
  dryRun?: boolean;
}

/**
 * Fail the cron/CLI boundary when an external adapter produced no usable rows
 * or reported any fetch/parse/write error. A partial adapter run may retain
 * diagnostic rows, but it must not masquerade as a successful fresh sync.
 */
export function assertExternalSyncSucceeded(
  adapterId: string,
  outcome: ExternalSyncOutcome,
): void {
  if (outcome.errors.length > 0) {
    throw new Error(`${adapterId} reported ${outcome.errors.length} error(s): ${outcome.errors.join(" | ")}`);
  }
  if (!Number.isSafeInteger(outcome.totalWritten) || outcome.totalWritten <= 0) {
    throw new Error(`${adapterId} produced zero usable rows`);
  }
}
