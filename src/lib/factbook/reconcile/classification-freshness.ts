import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export interface RequiredClassificationOutputs {
  worldBank: {
    regionRowsWritten: number;
    incomeRowsWritten: number;
    errors: readonly string[];
  };
  vdem: {
    rowsWritten: number;
    errors: readonly string[];
  };
  cia: {
    monarchyRowsWritten: number;
    formDescriptionRowsWritten: number;
    errors: readonly string[];
  };
  dryRun?: boolean;
}

/**
 * The combined job publishes five distinct required outputs. Checking only a
 * source-level total would let one healthy sibling hide an empty component
 * (for example, WB regions masking a missing income classification feed).
 */
export function assertRequiredClassificationOutputs(
  outputs: RequiredClassificationOutputs,
): void {
  const { worldBank, vdem, cia, dryRun } = outputs;
  assertExternalSyncSucceeded("factbook.classifications.world-bank.region", {
    totalWritten: worldBank.regionRowsWritten,
    errors: worldBank.errors,
    dryRun,
  });
  assertExternalSyncSucceeded("factbook.classifications.world-bank.income", {
    totalWritten: worldBank.incomeRowsWritten,
    errors: worldBank.errors,
    dryRun,
  });
  assertExternalSyncSucceeded("factbook.classifications.vdem", {
    totalWritten: vdem.rowsWritten,
    errors: vdem.errors,
    dryRun,
  });
  assertExternalSyncSucceeded("factbook.classifications.cia.monarchy", {
    totalWritten: cia.monarchyRowsWritten,
    errors: cia.errors,
    dryRun,
  });
  assertExternalSyncSucceeded("factbook.classifications.cia.government-form", {
    totalWritten: cia.formDescriptionRowsWritten,
    errors: cia.errors,
    dryRun,
  });
}

/**
 * Complete the combined classifications job only after every stage assertion
 * has passed. Keeping the assertion/flush boundary here makes it explicit and
 * testable that a failed aggregate can never advance source freshness.
 */
export async function finalizeClassificationFreshness(
  assertAllStagesSucceeded: () => void,
  flush: () => Promise<string[]>,
): Promise<string[]> {
  assertAllStagesSucceeded();
  return flush();
}
