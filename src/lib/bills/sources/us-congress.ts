import type { Bill as LegacyBill } from "@/lib/data/parliament-feeds";
import type { BillIngestDraft } from "../types";
import { statusToStage } from "../stage";

const SOURCE_ID = "congress_gov";

const TYPE_LABEL: Record<string, string> = {
  HR: "H.R.",
  HJRES: "H.J.Res.",
  HRES: "H.Res.",
  HCONRES: "H.Con.Res.",
  S: "S.",
  SJRES: "S.J.Res.",
  SRES: "S.Res.",
  SCONRES: "S.Con.Res.",
};

const TYPE_SLUG: Record<string, string> = {
  HR: "house-bill",
  S: "senate-bill",
  HJRES: "house-joint-resolution",
  SJRES: "senate-joint-resolution",
  HRES: "house-resolution",
  SRES: "senate-resolution",
  HCONRES: "house-concurrent-resolution",
  SCONRES: "senate-concurrent-resolution",
};

interface RawBill {
  title?: string;
  latestAction?: { text?: string; actionDate?: string };
  updateDate?: string;
  url?: string;
  congress?: number;
  type?: string;
  number?: number;
  introducedDate?: string;
}

interface CongressApiResponse {
  bills?: RawBill[];
}

/**
 * Hits the Congress.gov v3 API. Used both by the legacy live-fetch
 * path (5 bills, 1-hour cache, no API key required when DEMO_KEY is
 * sufficient) and by the sync script (larger batch, no cache, real
 * key recommended).
 *
 * @param limit how many bills to ask for; the API caps at 250 per
 *   request, default 5 keeps the legacy behaviour intact.
 */
async function fetchRaw(limit = 5, cache = true): Promise<RawBill[]> {
  const apiKey = process.env.CONGRESS_API_KEY ?? "DEMO_KEY";
  const init: RequestInit & { next?: { revalidate?: number } } = cache
    ? { next: { revalidate: 3600 } }
    : { cache: "no-store" };
  const res = await fetch(
    `https://api.congress.gov/v3/bill?format=json&limit=${limit}&sort=updateDate+desc&api_key=${apiKey}`,
    init,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as CongressApiResponse;
  return json.bills ?? [];
}

function buildIdentifier(b: RawBill): string | undefined {
  const typeLabel = b.type ? (TYPE_LABEL[b.type] ?? b.type) : "";
  return typeLabel && b.number != null ? `${typeLabel} ${b.number}` : undefined;
}

function buildPublicUrl(b: RawBill): string {
  const typeSlug = b.type ? (TYPE_SLUG[b.type] ?? b.type.toLowerCase()) : "bill";
  return `https://www.congress.gov/bill/${b.congress}th-congress/${typeSlug}/${b.number}`;
}

/**
 * Legacy live-fetch shape, used by `parliament-feeds.ts.fetchParliamentBills`.
 * Keeps the in-route fallback path working until everything reads from DB.
 */
export async function fetchUSBillsLive(): Promise<LegacyBill[]> {
  const raw = await fetchRaw(5, true);
  return raw.map((b) => {
    const identifier = buildIdentifier(b);
    const formalTitle = b.title ?? "Untitled";
    const displayTitle = identifier ?? formalTitle;
    return {
      title: displayTitle,
      longTitle: formalTitle !== displayTitle ? formalTitle : undefined,
      status: b.latestAction?.text ?? "In Congress",
      date: b.latestAction?.actionDate ?? b.updateDate ?? "",
      url: buildPublicUrl(b),
      source: SOURCE_ID,
      identifier,
    };
  });
}

/**
 * Sync-shaped fetch — returns `BillIngestDraft[]` aligned to the DB
 * schema, ready for `summarize.ts` + `upsert.ts`.
 *
 * Caller supplies `jurisdictionId` because looking it up needs DB
 * access; the adapter is otherwise pure.
 */
export async function fetchUSBillsForSync(opts: {
  jurisdictionId: string;
  /** Number of bills to pull. Congress.gov caps at 250; default 100. */
  limit?: number;
}): Promise<BillIngestDraft[]> {
  const raw = await fetchRaw(opts.limit ?? 100, false);
  return raw.map((b) => {
    const identifier = buildIdentifier(b);
    const formalTitle = b.title ?? "Untitled";
    const displayTitle = identifier ?? formalTitle;
    const lastAction = b.latestAction?.actionDate ?? b.updateDate ?? "";
    const externalId = `${b.congress ?? "0"}-${b.type?.toLowerCase() ?? "x"}-${b.number ?? "0"}`;
    return {
      jurisdictionId: opts.jurisdictionId,
      bodyId: null,
      sourceId: SOURCE_ID,
      externalId,
      title: displayTitle,
      longTitle: formalTitle !== displayTitle ? formalTitle : null,
      stage: statusToStage(b.latestAction?.text),
      rawStatus: b.latestAction?.text ?? null,
      introducedDate: b.introducedDate ?? null,
      lastActionDate: lastAction || new Date().toISOString().slice(0, 10),
      lastActionText: b.latestAction?.text ?? null,
      sponsorName: null,
      sponsorParty: null,
      url: buildPublicUrl(b),
      textUrl: null,
      voteYes: null,
      voteNo: null,
      voteAbstain: null,
      raw: b,
    };
  });
}
