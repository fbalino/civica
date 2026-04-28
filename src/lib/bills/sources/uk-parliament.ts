import type { Bill as LegacyBill } from "@/lib/data/parliament-feeds";
import type { BillIngestDraft } from "../types";
import { statusToStage } from "../stage";

const SOURCE_ID = "uk_parliament";

interface RawBill {
  billId?: number;
  shortTitle?: string;
  longTitle?: string;
  lastUpdate?: string;
  introducedSittingDate?: string;
  currentStage?: { description?: string };
  currentHouse?: string;
}

interface UKApiResponse {
  items?: RawBill[];
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
  return raw.map((b) => ({
    title: b.shortTitle ?? b.longTitle ?? "Untitled",
    summary:
      b.longTitle && b.shortTitle && b.longTitle !== b.shortTitle
        ? b.longTitle
        : undefined,
    status: b.currentStage?.description ?? "In Parliament",
    date: b.lastUpdate ?? "",
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
}): Promise<BillIngestDraft[]> {
  const raw = await fetchRaw(opts.limit ?? 100, false);
  return raw.map((b) => {
    const lastAction = b.lastUpdate
      ? b.lastUpdate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
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
      lastActionDate: lastAction,
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
