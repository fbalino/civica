/**
 * Germany — Bundestag DIP (Dokumentations- und Informationssystem für
 * Parlamentsmaterialien). Pulls `vorgang` records of type
 * "Gesetzgebung" (legislative bills), default-sorted by date desc.
 *
 * License: Bundestag Open Data (CC-BY-equivalent terms).
 *
 * Auth: requires an `apikey` query param. The public/anonymous key
 * documented at https://dip.bundestag.api.bund.dev/ and in the
 * bundesAPI/dip-bundestag-api repo is rate-limited but sufficient for
 * a 100-row daily sync. Production deploys can override by setting
 * `BUNDESTAG_API_KEY`.
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
import type { BillIngestDraft } from "../types";
import { statusToStage } from "../stage";

const SOURCE_ID = "bundestag_dip";

/** Public-anonymous key documented in the bundesAPI README. Override
 * via `BUNDESTAG_API_KEY` env var for higher rate limits. */
const PUBLIC_DIP_KEY = "OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw";

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
  documents?: DipDoc[];
}

async function fetchRaw(limit: number): Promise<DipDoc[]> {
  const apiKey = process.env.BUNDESTAG_API_KEY || PUBLIC_DIP_KEY;
  if (!apiKey) {
    console.warn(
      "[bills.de] No BUNDESTAG_API_KEY and no fallback key; skipping",
    );
    return [];
  }
  // The API doesn't expose a sort param; the default order is by
  // recency (most recently `aktualisiert` first), which is what we
  // want. Page size caps at 100 per request.
  const url = `https://search.dip.bundestag.de/api/v1/vorgang?f.vorgangstyp=Gesetzgebung&format=json&apikey=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[bills.de] DIP fetch ${res.status}; skipping`);
      return [];
    }
    const json = (await res.json()) as DipResponse;
    return (json.documents ?? []).slice(0, limit);
  } catch (err) {
    console.warn(
      `[bills.de] DIP fetch failed: ${err instanceof Error ? err.message : err}; skipping`,
    );
    return [];
  }
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
}): Promise<BillIngestDraft[]> {
  const raw = await fetchRaw(opts.limit ?? 100);

  // Resolve the Bundestag body id (chamber_type = "lower").
  const bodies = await opts.db
    .select({
      id: governmentBodies.id,
      chamberType: governmentBodies.chamberType,
    })
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, opts.jurisdictionId));
  const bodyId = bodies.find((b) => b.chamberType === "lower")?.id ?? null;

  return raw
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
}
