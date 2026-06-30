"use server";

import {
  getPublicAuditLogForDispute,
  type PublicAuditLogRow,
} from "@/lib/db/queries-data-disputes";

export async function loadAuditLog(
  disputeId: string,
): Promise<PublicAuditLogRow[]> {
  return getPublicAuditLogForDispute(disputeId);
}
