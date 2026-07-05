/**
 * Live nav-badge counts for the admin shell.
 *
 * One lightweight `count(*)` per section, run in parallel. These drive the
 * count chips in the left nav (neutral tone by default; accent when there's
 * something needing attention — pending Pulse events, open disputes, new
 * applications, new messages).
 *
 * Fail-soft: any query error returns 0 for that section (and logs a warning)
 * so the shell always renders even if the DB is briefly unreachable. The nav
 * is chrome, not a data surface — a missing badge must never blank the page.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pulseEventsV2,
  dataDisputes,
  advisoryApplications,
  contactSubmissions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface AdminCounts {
  /** Pulse events awaiting a reviewer decision (review_status='pending', unpublished). */
  pulsePending: number;
  /** Data disputes still open or in review. */
  disputesOpen: number;
  /** Advisory-board applications not yet triaged (status='new'). */
  advisoryNew: number;
  /** Contact messages not yet read (status='new'). */
  messagesNew: number;
}

async function countOr0(
  label: string,
  run: () => Promise<number>,
): Promise<number> {
  try {
    return await run();
  } catch (err) {
    console.warn(
      `[admin/counts] ${label} count failed:`,
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}

/**
 * Fetch every nav badge count in one parallel pass. Each count is isolated so
 * one failing query can't take down the others.
 */
export async function getAdminCounts(): Promise<AdminCounts> {
  const [pulsePending, disputesOpen, advisoryNew, messagesNew] =
    await Promise.all([
      countOr0("pulse", async () => {
        const rows = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(pulseEventsV2)
          .where(
            and(
              eq(pulseEventsV2.reviewStatus, "pending"),
              eq(pulseEventsV2.published, false),
            ),
          );
        return rows[0]?.n ?? 0;
      }),
      countOr0("disputes", async () => {
        const rows = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(dataDisputes)
          .where(sql`${dataDisputes.status} in ('open', 'in_review')`);
        return rows[0]?.n ?? 0;
      }),
      countOr0("advisory", async () => {
        const rows = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(advisoryApplications)
          .where(eq(advisoryApplications.status, "new"));
        return rows[0]?.n ?? 0;
      }),
      countOr0("messages", async () => {
        const rows = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(contactSubmissions)
          .where(eq(contactSubmissions.status, "new"));
        return rows[0]?.n ?? 0;
      }),
    ]);

  return { pulsePending, disputesOpen, advisoryNew, messagesNew };
}
