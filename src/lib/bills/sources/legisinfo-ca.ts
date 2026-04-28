import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { governmentBodies } from "@/lib/db/schema";
import type { BillIngestDraft } from "../types";
import { statusToStage } from "../stage";

const SOURCE_ID = "legisinfo_ca";

/**
 * LEGISinfo bulk JSON for the current parliamentary session.
 * Single feed contains both House (C-*) and Senate (S-*) bills.
 *
 * License: Open Government Licence – Canada (CC-BY-equivalent).
 *
 * Discovery notes (as of 2026-04):
 *  - The HTML "?download=json" button on `/legisinfo/en/bills` actually
 *    points at `/legisinfo/en/bills/json?parlsession=<session>`. That's
 *    the endpoint we hit.
 *  - All entries in a session response have `IsFromCurrentSession=true`,
 *    so no filtering needed.
 *  - `OriginatingChamberId` 1 = House of Commons, 2 = Senate. Used to
 *    populate `bills.body_id` (first H.1/H.2 source where we do this).
 */
const PARL_SESSION = "45-1";

interface RawBill {
  BillId?: number;
  BillNumberFormatted?: string;
  LongTitleEn?: string;
  ShortTitleEn?: string;
  CurrentStatusEn?: string;
  LatestCompletedMajorStageEn?: string;
  LatestActivityEn?: string;
  LatestActivityDateTime?: string;
  ReceivedRoyalAssentDateTime?: string | null;
  PassedHouseThirdReadingDateTime?: string | null;
  PassedSenateThirdReadingDateTime?: string | null;
  PassedHouseFirstReadingDateTime?: string | null;
  PassedSenateFirstReadingDateTime?: string | null;
  OriginatingChamberId?: number;
  ParlSessionCode?: string;
  SponsorEn?: string | null;
  IsFromCurrentSession?: boolean;
}

async function fetchRaw(): Promise<RawBill[]> {
  const url = `https://www.parl.ca/legisinfo/en/bills/json?parlsession=${PARL_SESSION}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as RawBill[];
  return Array.isArray(json) ? json : [];
}

/**
 * LEGISinfo exposes structural booleans (`ReceivedRoyalAssentDateTime`,
 * `PassedHouseThirdReadingDateTime`, ...) which are far more reliable
 * than free-text status strings — use those first, fall back to the
 * shared `statusToStage` helper if none match.
 */
function structuralStage(b: RawBill): number {
  if (b.ReceivedRoyalAssentDateTime) return 4;
  if (
    b.PassedHouseThirdReadingDateTime ||
    b.PassedSenateThirdReadingDateTime
  ) {
    return 3;
  }
  return statusToStage(
    b.LatestCompletedMajorStageEn ?? b.CurrentStatusEn ?? null,
  );
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function publicUrl(b: RawBill): string {
  const session = b.ParlSessionCode ?? PARL_SESSION;
  const number = (b.BillNumberFormatted ?? "").toLowerCase();
  return number
    ? `https://www.parl.ca/legisinfo/en/bill/${session}/${number}`
    : `https://www.parl.ca/legisinfo/en/bills`;
}

/**
 * Mirrors the US adapter convention: `title` is the short bill identifier
 * (e.g. "C-275"), `longTitle` is the formal descriptive title. The bills
 * API route concatenates the two as "<title> - <longTitle>" for display.
 */
function pickTitle(b: RawBill): { title: string; longTitle: string | null } {
  const identifier = b.BillNumberFormatted?.trim() || "";
  const formal = b.LongTitleEn?.trim() || b.ShortTitleEn?.trim() || "Untitled";
  return identifier
    ? { title: identifier, longTitle: formal }
    : { title: formal, longTitle: null };
}

/**
 * Fetch the active session and shape into `BillIngestDraft[]`.
 * Resolves `bodyId` from `governmentBodies` keyed on `chamber_type`.
 */
export async function fetchCABillsForSync(opts: {
  jurisdictionId: string;
  /** Database handle — needed to look up House/Senate body IDs. */
  db: NeonHttpDatabase<typeof schema>;
  /** How many of the most-recently-active bills to keep. Default 100. */
  limit?: number;
}): Promise<BillIngestDraft[]> {
  const raw = await fetchRaw();

  const bodies = await opts.db
    .select({
      id: governmentBodies.id,
      chamberType: governmentBodies.chamberType,
    })
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, opts.jurisdictionId));
  const bodyByChamber = new Map<string, string>();
  for (const b of bodies) {
    if (b.chamberType) bodyByChamber.set(b.chamberType, b.id);
  }

  // Sort by latest activity desc, slice to limit.
  const sorted = [...raw].sort((a, b) => {
    const da = a.LatestActivityDateTime ?? "";
    const db = b.LatestActivityDateTime ?? "";
    return db.localeCompare(da);
  });
  const limited = sorted.slice(0, opts.limit ?? 100);

  return limited.map((b) => {
    const { title, longTitle } = pickTitle(b);
    const lastAction =
      isoDate(b.LatestActivityDateTime) ??
      new Date().toISOString().slice(0, 10);
    const introduced =
      isoDate(
        b.PassedHouseFirstReadingDateTime ??
          b.PassedSenateFirstReadingDateTime,
      );
    const chamberKey = b.OriginatingChamberId === 2 ? "upper" : "lower";
    const bodyId = bodyByChamber.get(chamberKey) ?? null;

    return {
      jurisdictionId: opts.jurisdictionId,
      bodyId,
      sourceId: SOURCE_ID,
      externalId: String(b.BillId ?? b.BillNumberFormatted ?? ""),
      title,
      longTitle,
      stage: structuralStage(b),
      rawStatus: b.CurrentStatusEn ?? null,
      introducedDate: introduced,
      lastActionDate: lastAction,
      lastActionText: b.LatestActivityEn ?? null,
      sponsorName: b.SponsorEn ?? null,
      sponsorParty: null,
      url: publicUrl(b),
      textUrl: null,
      voteYes: null,
      voteNo: null,
      voteAbstain: null,
      raw: b,
    };
  });
}
