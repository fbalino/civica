import type { Bill as LegacyBill } from "@/lib/data/parliament-feeds";
import type { BillIngestDraft } from "../types";
import { statusToStage } from "../stage";
import {
  BILL_LAST_ACTION_REASONS,
  absentLastAction,
  lastActionFields,
  latestPublisherActionDate,
  observedLastAction,
  type BillLastAction,
} from "../last-action";

const SOURCE_ID = "uk_parliament";

interface RawBill {
  billId?: number;
  shortTitle?: string;
  longTitle?: string;
  lastUpdate?: string;
  introducedSittingDate?: string;
  currentStage?: {
    description?: string;
    stageSittings?: Array<{ date?: string | null } | null> | null;
  };
  currentHouse?: string;
}

interface UKApiResponse {
  items?: RawBill[];
}

/**
 * The Bills API `BillSummary.lastUpdate` is the record's update time (the list
 * is sorted by it as `DateUpdatedDescending`), not a sitting date. The dated
 * legislative step in the same record is `currentStage.stageSittings[].date`:
 * the sittings of the bill's current stage. The latest sitting on or before
 * retrieval is the last action; a later one is scheduled, not taken.
 */
export function ukLastAction(raw: unknown, retrievedAt: Date): BillLastAction {
  const sittings = (raw as RawBill | null)?.currentStage?.stageSittings;
  const date = latestPublisherActionDate(
    Array.isArray(sittings) ? sittings.map((sitting) => sitting?.date) : [],
    retrievedAt,
  );
  return date
    ? observedLastAction(date)
    : absentLastAction("not_observed", BILL_LAST_ACTION_REASONS.ukNoSitting);
}

async function fetchRaw(take = 5, cache = true): Promise<RawBill[]> {
  const init: RequestInit & { next?: { revalidate?: number } } = cache
    ? { next: { revalidate: 3600 } }
    : { cache: "no-store" };
  const res = await fetch(
    `https://bills-api.parliament.uk/api/v1/Bills?SortOrder=DateUpdatedDescending&Take=${take}`,
    init,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as UKApiResponse;
  return json.items ?? [];
}

/** Legacy live-fetch shape — used by `parliament-feeds.ts.fetchParliamentBills`. */
export async function fetchUKBillsLive(): Promise<LegacyBill[]> {
  const raw = await fetchRaw(5, true);
  const retrievedAt = new Date();
  return raw.map((b) => ({
    title: b.shortTitle ?? b.longTitle ?? "Untitled",
    summary:
      b.longTitle && b.shortTitle && b.longTitle !== b.shortTitle
        ? b.longTitle
        : undefined,
    status: b.currentStage?.description ?? "In Parliament",
    date: ukLastAction(b, retrievedAt).date ?? "",
    url: `https://bills.parliament.uk/bills/${b.billId}`,
    source: SOURCE_ID,
    identifier: b.billId != null ? String(b.billId) : undefined,
  }));
}

/** Sync-shaped fetch — returns `BillIngestDraft[]`. */
export async function fetchUKBillsForSync(opts: {
  jurisdictionId: string;
  /** UK API caps at 100 per page; default 100. */
  limit?: number;
  /** Retrieval time; fixtures pin it. Defaults to now. */
  retrievedAt?: Date;
}): Promise<BillIngestDraft[]> {
  const raw = await fetchRaw(opts.limit ?? 100, false);
  const retrievedAt = opts.retrievedAt ?? new Date();
  return raw.map((b) => {
    return {
      jurisdictionId: opts.jurisdictionId,
      bodyId: null,
      sourceId: SOURCE_ID,
      externalId: String(b.billId ?? "0"),
      title: b.shortTitle ?? b.longTitle ?? "Untitled",
      longTitle:
        b.longTitle && b.shortTitle && b.longTitle !== b.shortTitle
          ? b.longTitle
          : null,
      stage: statusToStage(b.currentStage?.description),
      rawStatus: b.currentStage?.description ?? null,
      introducedDate: b.introducedSittingDate
        ? b.introducedSittingDate.slice(0, 10)
        : null,
      ...lastActionFields(ukLastAction(b, retrievedAt)),
      lastActionText: b.currentStage?.description ?? null,
      sponsorName: null,
      sponsorParty: null,
      url: `https://bills.parliament.uk/bills/${b.billId}`,
      textUrl: null,
      voteYes: null,
      voteNo: null,
      voteAbstain: null,
      raw: b,
    };
  });
}
