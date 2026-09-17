/**
 * Germany — Bundestag DIP (Dokumentations- und Informationssystem für
 * Parlamentsmaterialien). Pulls `vorgang` records of type
 * "Gesetzgebung" (legislative bills), default-sorted by date desc.
 *
 * License: Bundestag Open Data (CC-BY-equivalent terms).
 *
 * Auth: requires `BUNDESTAG_API_KEY`. The Bundestag publishes a rotating
 * public key and also offers dedicated keys; neither belongs in source code.
 * The key is sent in the Authorization header so it cannot enter request URLs.
 *
 * Original German titles are stored in `bills.title`; the shared
 * summariser produces an English plain-language summary at sync time.
 *
 * `bodyId` is set to the Bundestag (chamber_type = "lower"). Bundesrat
 * is the "upper" chamber but DIP `vorgang/Gesetzgebung` covers federal
 * legislation as a whole, not the chamber-of-introduction split.
 */

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

const SOURCE_ID = "bundestag_dip";
const DIP_VORGANG_URL = "https://search.dip.bundestag.de/api/v1/vorgang";
const MAX_PAGES = 10;

interface DipDoc {
  id?: string;
  titel?: string;
  beratungsstand?: string;
  vorgangstyp?: string;
  datum?: string;
  aktualisiert?: string;
  initiative?: string[];
  wahlperiode?: number;
  gesta?: string;
}
interface DipResponse {
  numFound?: number;
  cursor?: string;
  documents?: DipDoc[];
}

async function fetchRaw(limit: number): Promise<{
  rows: DipDoc[];
  outcome: BillFetchBatch["sourceOutcomes"][number];
}> {
  const apiKey = process.env.BUNDESTAG_API_KEY?.trim();
  if (!apiKey) {
    return {
      rows: [],
      outcome: failedBillSourceOutcome(
        SOURCE_ID,
        "source_configuration_missing",
        "BUNDESTAG_API_KEY is not configured",
      ),
    };
  }

  const legislation: DipDoc[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES && legislation.length < limit; page++) {
    const url = new URL(DIP_VORGANG_URL);
    url.searchParams.set("format", "json");
    if (cursor) url.searchParams.set("cursor", cursor);
    let res: Response;
    try {
      res = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
          "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
        },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      return {
        rows: [],
        outcome: failedBillSourceRequestOutcome(SOURCE_ID, error),
      };
    }
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
    if (!isDipResponse(json)) {
      return {
        rows: [],
        outcome: failedBillSourceOutcome(
          SOURCE_ID,
          "source_schema_invalid",
          "publisher response did not match the DIP list schema",
        ),
      };
    }
    legislation.push(
      ...json.documents.filter(
        (document) => document.vorgangstyp === "Gesetzgebung",
      ),
    );

    const nextCursor = json.cursor?.trim() || null;
    if (json.documents.length === 0 || !nextCursor || nextCursor === cursor)
      break;
    cursor = nextCursor;
  }

  const rows = legislation.slice(0, limit);
  if (rows.length === 0) {
    return {
      rows: [],
      outcome: failedBillSourceOutcome(
        SOURCE_ID,
        "source_empty_unexpected",
        "DIP returned no legislative proceedings in the inspected pages",
      ),
    };
  }
  return {
    rows,
    outcome: {
      sourceId: SOURCE_ID,
      status: "success",
      fetched: rows.length,
      mapped: 0,
    },
  };
}

function isDipResponse(
  value: unknown,
): value is DipResponse & { documents: DipDoc[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as DipResponse;
  return (
    Array.isArray(response.documents) &&
    response.documents.every(
      (document) =>
        document && typeof document === "object" && !Array.isArray(document),
    )
  );
}

/** Build a stable, human-readable identifier from the gesta number
 * (e.g. "Gesta C064") if present, otherwise fall back to the DIP id. */
function pickIdentifier(d: DipDoc): string {
  if (d.gesta) return `Gesta ${d.gesta}`;
  return d.id ? `Vorgang ${d.id}` : "Vorgang";
}

function publicUrl(d: DipDoc): string {
  return d.id
    ? `https://dip.bundestag.de/vorgang/-/${d.id}`
    : "https://dip.bundestag.de/";
}

export async function fetchDEBillsForSync(opts: {
  jurisdictionId: string;
  db: NeonHttpDatabase<typeof schema>;
  /** Default 100 (DIP page size). */
  limit?: number;
}): Promise<BillFetchBatch> {
  const fetched = await fetchRaw(opts.limit ?? 100);
  if (fetched.outcome.status === "failed") {
    return { drafts: [], sourceOutcomes: [fetched.outcome] };
  }

  // Resolve the Bundestag body id (chamber_type = "lower").
  const bodies = await opts.db
    .select({
      id: governmentBodies.id,
      chamberType: governmentBodies.chamberType,
    })
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, opts.jurisdictionId));
  const bodyId = bodies.find((b) => b.chamberType === "lower")?.id ?? null;

  const drafts = fetched.rows
    .filter((d) => d.id && d.titel)
    .map((d) => {
      const identifier = pickIdentifier(d);
      const formal = d.titel?.trim() || identifier;
      const lastAction =
        (d.aktualisiert ?? d.datum ?? "").slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
      return {
        jurisdictionId: opts.jurisdictionId,
        bodyId,
        sourceId: SOURCE_ID,
        externalId: String(d.id),
        title: identifier,
        longTitle: formal !== identifier ? formal : null,
        stage: statusToStage(d.beratungsstand),
        rawStatus: d.beratungsstand ?? null,
        introducedDate: d.datum ?? null,
        lastActionDate: lastAction,
        lastActionText: d.beratungsstand ?? null,
        sponsorName: d.initiative?.[0] ?? null,
        sponsorParty: null,
        url: publicUrl(d),
        textUrl: null,
        voteYes: null,
        voteNo: null,
        voteAbstain: null,
        raw: d,
      } satisfies BillIngestDraft;
    });
  return {
    drafts,
    sourceOutcomes: [
      finalizeBillSourceMapping(fetched.outcome, drafts.length, {
        requireCompleteMapping: true,
        zeroMappedError: `${fetched.rows.length - drafts.length} DIP proceeding(s) lacked a stable id or title`,
      }),
    ],
  };
}
