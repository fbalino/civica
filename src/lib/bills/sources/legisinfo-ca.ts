import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { governmentBodies } from "@/lib/db/schema";
import type { BillFetchBatch, BillIngestDraft } from "../types";
import {
  failedBillSourceHttpOutcome,
  failedBillSourceOutcome,
  failedBillSourceRequestOutcome,
  finalizeBillSourceMapping,
} from "../source-outcome";
import { statusToStage } from "../stage";

const SOURCE_ID = "legisinfo_ca";

/**
 * LEGISinfo bulk JSON for the current parliamentary session.
 * Single feed contains both House (C-*) and Senate (S-*) bills.
 *
 * License: Open Government Licence – Canada (CC-BY-equivalent).
 *
 * Contract verified against the publisher response on 2026-09-17:
 *  - `/legisinfo/en/bills/json` returns the active session. The optional
 *    `parlsession` query is accepted by GET but is not required.
 *  - `ParliamentNumber` + `SessionNumber` identify the session.
 *  - `OriginatingChamberOrganizationId` 1 = House, 2 = Senate. Used to
 *    populate `bills.body_id` (first H.1/H.2 source where we do this).
 */
const BULK_URL = "https://www.parl.ca/legisinfo/en/bills/json";

interface RawBill {
  Id?: number;
  NumberCode?: string;
  LongTitleEn?: string;
  ShortTitleEn?: string;
  StatusNameEn?: string;
  LatestCompletedMajorStageNameEn?: string;
  LatestCompletedMajorStageDateTime?: string | null;
  LatestBillEventTypeNameEn?: string | null;
  LatestBillEventDateTime?: string | null;
  ReceivedRoyalAssentDateTime?: string | null;
  PassedHouseThirdReadingDateTime?: string | null;
  PassedSenateThirdReadingDateTime?: string | null;
  PassedHouseSecondReadingDateTime?: string | null;
  PassedSenateSecondReadingDateTime?: string | null;
  PassedHouseFirstReadingDateTime?: string | null;
  PassedSenateFirstReadingDateTime?: string | null;
  OriginatingChamberOrganizationId?: number;
  ParliamentNumber?: number;
  SessionNumber?: number;
  SponsorPersonName?: string | null;
  IsSessionOngoing?: boolean;
}

async function fetchRaw(): Promise<{
  rows: RawBill[];
  outcome: BillFetchBatch["sourceOutcomes"][number];
}> {
  try {
    const res = await fetch(BULK_URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return {
        rows: [],
        outcome: failedBillSourceHttpOutcome(SOURCE_ID, res.status),
      };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return {
        rows: [],
        outcome: failedBillSourceOutcome(
          SOURCE_ID,
          "source_payload_invalid",
          "publisher response was not valid JSON",
        ),
      };
    }
    if (!Array.isArray(json)) {
      return {
        rows: [],
        outcome: failedBillSourceOutcome(
          SOURCE_ID,
          "source_schema_invalid",
          "publisher response was not a bill array",
        ),
      };
    }
    if (json.length === 0) {
      return {
        rows: [],
        outcome: failedBillSourceOutcome(
          SOURCE_ID,
          "source_empty_unexpected",
          "active-session feed returned no bills",
        ),
      };
    }
    return {
      rows: json as RawBill[],
      outcome: {
        sourceId: SOURCE_ID,
        status: "success",
        fetched: json.length,
        mapped: 0,
      },
    };
  } catch (error) {
    return {
      rows: [],
      outcome: failedBillSourceRequestOutcome(SOURCE_ID, error),
    };
  }
}

/**
 * LEGISinfo exposes structural booleans (`ReceivedRoyalAssentDateTime`,
 * `PassedHouseThirdReadingDateTime`, ...) which are far more reliable
 * than free-text status strings — use those first, fall back to the
 * shared `statusToStage` helper if none match.
 */
function structuralStage(b: RawBill): number {
  if (b.ReceivedRoyalAssentDateTime) return 4;
  if (b.PassedHouseThirdReadingDateTime || b.PassedSenateThirdReadingDateTime) {
    return 3;
  }
  return statusToStage(
    b.LatestCompletedMajorStageNameEn ?? b.StatusNameEn ?? null,
  );
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function publicUrl(b: RawBill): string {
  const session =
    b.ParliamentNumber && b.SessionNumber
      ? `${b.ParliamentNumber}-${b.SessionNumber}`
      : null;
  const number = (b.NumberCode ?? "").toLowerCase();
  return session && number
    ? `https://www.parl.ca/legisinfo/en/bill/${session}/${number}`
    : `https://www.parl.ca/legisinfo/en/bills`;
}

/**
 * Mirrors the US adapter convention: `title` is the short bill identifier
 * (e.g. "C-275"), `longTitle` is the formal descriptive title. The bills
 * API route concatenates the two as "<title> - <longTitle>" for display.
 */
function pickTitle(b: RawBill): { title: string; longTitle: string | null } {
  const identifier = b.NumberCode?.trim() || "";
  const formal = b.LongTitleEn?.trim() || b.ShortTitleEn?.trim() || "Untitled";
  return identifier
    ? { title: identifier, longTitle: formal }
    : { title: formal, longTitle: null };
}

/**
 * Fetch the active session and shape it into a source-evidenced batch.
 * Resolves `bodyId` from `governmentBodies` keyed on `chamber_type`.
 */
export async function fetchCABillsForSync(opts: {
  jurisdictionId: string;
  /** Database handle — needed to look up House/Senate body IDs. */
  db: NeonHttpDatabase<typeof schema>;
  /** How many of the most-recently-active bills to keep. Default 100. */
  limit?: number;
}): Promise<BillFetchBatch> {
  const fetched = await fetchRaw();
  if (fetched.outcome.status === "failed") {
    return { drafts: [], sourceOutcomes: [fetched.outcome] };
  }

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
  const sorted = [...fetched.rows].sort((a, b) => {
    const da = latestActionDate(a) ?? "";
    const db = latestActionDate(b) ?? "";
    return db.localeCompare(da);
  });
  const limited = sorted.slice(0, opts.limit ?? 100);

  const drafts = limited.flatMap((b): BillIngestDraft[] => {
    if (
      !b.Id ||
      !b.NumberCode?.trim() ||
      !(b.LongTitleEn?.trim() || b.ShortTitleEn?.trim()) ||
      !b.ParliamentNumber ||
      !b.SessionNumber ||
      ![1, 2].includes(b.OriginatingChamberOrganizationId ?? 0)
    ) {
      return [];
    }
    const { title, longTitle } = pickTitle(b);
    const lastAction = latestActionDate(b);
    if (!lastAction) return [];
    const introduced =
      isoDate(b.PassedHouseFirstReadingDateTime) ??
      isoDate(b.PassedSenateFirstReadingDateTime);
    const chamberKey =
      b.OriginatingChamberOrganizationId === 2 ? "upper" : "lower";
    const bodyId = bodyByChamber.get(chamberKey) ?? null;

    return [
      {
        jurisdictionId: opts.jurisdictionId,
        bodyId,
        sourceId: SOURCE_ID,
        externalId: String(b.Id),
        title,
        longTitle,
        stage: structuralStage(b),
        rawStatus: b.StatusNameEn ?? null,
        introducedDate: introduced,
        lastActionDate: lastAction,
        lastActionText: b.LatestBillEventTypeNameEn ?? b.StatusNameEn ?? null,
        sponsorName: b.SponsorPersonName?.trim() || null,
        sponsorParty: null,
        url: publicUrl(b),
        textUrl: null,
        voteYes: null,
        voteNo: null,
        voteAbstain: null,
        raw: b,
      },
    ];
  });

  const outcome = finalizeBillSourceMapping(
    { ...fetched.outcome, fetched: limited.length },
    drafts.length,
    {
      requireCompleteMapping: true,
      zeroMappedError: `${limited.length - drafts.length} Canadian bill row(s) did not match the current LEGISinfo schema`,
    },
  );
  return { drafts, sourceOutcomes: [outcome] };
}

function latestActionDate(b: RawBill): string | null {
  const dates = [
    b.LatestBillEventDateTime,
    b.LatestCompletedMajorStageDateTime,
    b.ReceivedRoyalAssentDateTime,
    b.PassedHouseThirdReadingDateTime,
    b.PassedSenateThirdReadingDateTime,
    b.PassedHouseSecondReadingDateTime,
    b.PassedSenateSecondReadingDateTime,
    b.PassedHouseFirstReadingDateTime,
    b.PassedSenateFirstReadingDateTime,
  ]
    .map(isoDate)
    .filter((date): date is string => date !== null);
  return dates.sort().at(-1) ?? null;
}
