/**
 * France — merged adapter for the two chambers of Parlement français:
 *   - Assemblée Nationale (`data_assemblee_fr`): bulk-zipped JSON dump of
 *     every legislative dossier in the current legislature.
 *   - Sénat (`senat_fr`): bulk CSV of every dossier législatif since
 *     1977 (current rows are the recent ones).
 *
 * Daily-fetch + diff: download both bulks, parse, sort by recency, slice
 * to top-N. The (sourceId, externalId) unique index makes the upsert
 * idempotent — repeat syncs become cheap UPDATEs.
 *
 * License: Etalab Open Licence v2.0 for both chambers — open data law,
 * commercial use allowed with attribution.
 *
 * Each chamber reports a structured outcome. A failure in either chamber
 * makes the aggregate scheduled sync fail before it writes rows or advances
 * source freshness; successful empty feeds remain distinguishable from
 * failures.
 *
 * Original French titles are stored in `bills.title`; the shared
 * summariser produces an English plain-language summary at sync time.
 *
 * `bodyId` resolves from `governmentBodies.chamber_type`:
 *   - "lower" → Assemblée Nationale
 *   - "upper" → Sénat
 */

import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { governmentBodies } from "@/lib/db/schema";
import type {
  BillFetchBatch,
  BillIngestDraft,
  BillSourceFetchOutcome,
} from "../types";
import { finalizeBillSourceMapping } from "../source-outcome";
import { statusToStage } from "../stage";

const AN_SOURCE_ID = "data_assemblee_fr";
const SENAT_SOURCE_ID = "senat_fr";

/* ---------- Assemblée Nationale ---------- */

const AN_BULK_URL =
  "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip";

interface AnDossier {
  uid?: string;
  legislature?: string;
  titreDossier?: { titre?: string; titreChemin?: string };
  procedureParlementaire?: { code?: string; libelle?: string };
  actesLegislatifs?: unknown;
  "@xsi:type"?: string;
}

interface ExtractedAct {
  date: string;
  libelle: string;
}

type ChamberFetchResult<T> = {
  rows: T[];
  outcome: BillSourceFetchOutcome;
};

function failedFetch<T>(
  sourceId: string,
  error: unknown,
  fetched = 0,
): ChamberFetchResult<T> {
  return {
    rows: [],
    outcome: {
      sourceId,
      status: "failed",
      fetched,
      mapped: 0,
      error: error instanceof Error ? error.message : String(error),
    },
  };
}

function successfulFetch<T>(
  sourceId: string,
  rows: T[],
): ChamberFetchResult<T> {
  return {
    rows,
    outcome: {
      sourceId,
      status: "success",
      fetched: rows.length,
      mapped: 0,
    },
  };
}

/** Walk the recursive `actesLegislatifs` tree and return the latest
 * concrete act (datedActe + libelleActe) so we can populate
 * lastActionDate / lastActionText / stage. */
function walkLatestAct(node: unknown): ExtractedAct | null {
  let best: ExtractedAct | null = null;
  const visit = (n: unknown) => {
    if (!n) return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    if (typeof n !== "object") return;
    const obj = n as Record<string, unknown>;
    if (typeof obj.dateActe === "string" && obj.dateActe.length >= 10) {
      const date = obj.dateActe.slice(0, 10);
      const lib =
        (obj.libelleActe as { libelleCourt?: string; nomCanonique?: string })
          ?.libelleCourt ||
        (obj.libelleActe as { nomCanonique?: string })?.nomCanonique ||
        "";
      if (!best || date > best.date) {
        best = { date, libelle: lib };
      }
    }
    if (obj.acteLegislatif) visit(obj.acteLegislatif);
    if (obj.actesLegislatifs) visit(obj.actesLegislatifs);
  };
  visit(node);
  return best;
}

async function fetchAN(limit: number): Promise<ChamberFetchResult<AnDossier>> {
  // adm-zip is a CommonJS module imported only at runtime — keeps it
  // out of the Next.js client bundle.
  let AdmZip: typeof import("adm-zip");
  try {
    AdmZip = (await import("adm-zip")).default;
  } catch (err) {
    return failedFetch(AN_SOURCE_ID, err);
  }
  try {
    const res = await fetch(AN_BULK_URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      return failedFetch(AN_SOURCE_ID, `HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(buf);
    const entries = zip
      .getEntries()
      .filter((e) => e.entryName.endsWith(".json"));
    if (entries.length === 0) {
      return failedFetch(
        AN_SOURCE_ID,
        "bulk archive contained no JSON entries",
      );
    }

    type Stamped = { dossier: AnDossier; latest: ExtractedAct | null };
    const out: Stamped[] = [];
    let malformedEntries = 0;
    for (const e of entries) {
      try {
        const json = JSON.parse(e.getData().toString("utf-8")) as {
          dossierParlementaire?: AnDossier;
        };
        const j = json.dossierParlementaire;
        if (!j || j["@xsi:type"] !== "DossierLegislatif_Type") continue;
        out.push({ dossier: j, latest: walkLatestAct(j.actesLegislatifs) });
      } catch {
        malformedEntries++;
      }
    }
    if (out.length === 0) {
      return failedFetch(
        AN_SOURCE_ID,
        malformedEntries > 0
          ? `all ${malformedEntries} JSON entries were malformed`
          : `${entries.length} JSON entries contained no recognized legislative dossiers`,
        entries.length,
      );
    }
    out.sort((a, b) =>
      (b.latest?.date ?? "").localeCompare(a.latest?.date ?? ""),
    );
    return successfulFetch(
      AN_SOURCE_ID,
      out.slice(0, limit).map((s) => s.dossier),
    );
  } catch (err) {
    return failedFetch(AN_SOURCE_ID, err);
  }
}

function anDraft(
  d: AnDossier,
  jurisdictionId: string,
  bodyId: string | null,
): BillIngestDraft | null {
  if (!d.uid) return null;
  const titre = d.titreDossier?.titre?.trim() || "Untitled";
  const procedure = d.procedureParlementaire?.libelle?.trim() || "Dossier";
  const latest = walkLatestAct(d.actesLegislatifs);
  const lastAction = latest?.date ?? new Date().toISOString().slice(0, 10);
  const lastText = latest?.libelle ?? null;
  // Build a friendly identifier from the procedure code + legislative
  // dossier number (last numeric chunk of the uid, e.g. DLR5L17N54085 → 54085).
  const numMatch = d.uid.match(/N(\d+)$/);
  const identifier = numMatch ? `${procedure} ${numMatch[1]}` : procedure;
  const url = d.titreDossier?.titreChemin
    ? `https://www.assemblee-nationale.fr/dyn/${d.legislature ?? "17"}/dossiers/${d.titreDossier.titreChemin}`
    : "https://www.assemblee-nationale.fr/dyn/17/dossiers";
  return {
    jurisdictionId,
    bodyId,
    sourceId: AN_SOURCE_ID,
    externalId: d.uid,
    title: identifier,
    longTitle: titre,
    stage: statusToStage(lastText),
    rawStatus: lastText,
    introducedDate: null,
    lastActionDate: lastAction,
    lastActionText: lastText,
    sponsorName: null,
    sponsorParty: null,
    url,
    textUrl: null,
    voteYes: null,
    voteNo: null,
    voteAbstain: null,
    raw: d,
  };
}

/* ---------- Sénat ---------- */

const SENAT_CSV_URL =
  "https://data.senat.fr/data/dosleg/dossiers-legislatifs.csv";

interface SenatRow {
  titre: string;
  type: string;
  dateInitiale: string; // DD/MM/YYYY
  url: string;
  etat: string;
  decisionCC: string;
  dateDecision: string;
  datePromulgation: string;
  numeroLoi: string;
  themes: string;
}

/** Minimal CSV parser tuned to the data.senat.fr format: `;`-delimited,
 * `"`-quoted, latin-1 source. Quoted fields may contain `;` but not
 * embedded quotes (verified empirically against the live file). */
function parseSenatCsv(text: string): SenatRow[] {
  const rows: SenatRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Strip outer quotes; split on `";"`.
    if (!line.startsWith('"')) continue;
    const inner = line.slice(1, line.endsWith('"') ? -1 : undefined);
    const cells = inner.split('";"');
    if (cells.length < 10) continue;
    rows.push({
      titre: cells[0],
      type: cells[1],
      dateInitiale: cells[2],
      url: cells[3],
      etat: cells[4],
      decisionCC: cells[5],
      dateDecision: cells[6],
      datePromulgation: cells[7],
      numeroLoi: cells[8],
      themes: cells[9],
    });
  }
  return rows;
}

function ddmmyyyyToIso(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function fetchSenat(
  limit: number,
): Promise<ChamberFetchResult<SenatRow>> {
  try {
    const res = await fetch(SENAT_CSV_URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return failedFetch(SENAT_SOURCE_ID, `HTTP ${res.status}`);
    }
    // Sénat CSV is served as latin-1; decode explicitly.
    const buf = Buffer.from(await res.arrayBuffer());
    const text = new TextDecoder("iso-8859-1").decode(buf);
    const lines = text.split(/\r?\n/);
    if (!lines[0]?.toLowerCase().includes("titre")) {
      return failedFetch(SENAT_SOURCE_ID, "CSV header was not recognized");
    }
    const rows = parseSenatCsv(text);
    const structuredDataLines = lines.slice(1).filter((line) => line.trim());
    if (structuredDataLines.length > 0 && rows.length === 0) {
      return failedFetch(
        SENAT_SOURCE_ID,
        `${structuredDataLines.length} non-empty CSV row(s) produced zero recognized records`,
        structuredDataLines.length,
      );
    }
    rows.sort((a, b) => {
      const da = ddmmyyyyToIso(a.dateInitiale) ?? "";
      const db = ddmmyyyyToIso(b.dateInitiale) ?? "";
      return db.localeCompare(da);
    });
    return successfulFetch(SENAT_SOURCE_ID, rows.slice(0, limit));
  } catch (err) {
    return failedFetch(SENAT_SOURCE_ID, err);
  }
}

function senatDraft(
  r: SenatRow,
  jurisdictionId: string,
  bodyId: string | null,
): BillIngestDraft | null {
  // External id derived from the dossier URL slug, which is stable
  // across re-syncs — e.g. "ppl25-563.html" → "ppl25-563".
  const slug = r.url.match(/\/dossier-legislatif\/([^.]+)\./)?.[1];
  if (!slug || !r.titre) return null;
  const introduced = ddmmyyyyToIso(r.dateInitiale);
  const lastAction =
    ddmmyyyyToIso(r.datePromulgation) ??
    ddmmyyyyToIso(r.dateDecision) ??
    introduced ??
    new Date().toISOString().slice(0, 10);
  // Status precedence: promulgué > état > "Première lecture (Sénat)"
  const status = r.datePromulgation ? "Promulgué" : r.etat || "Déposée";
  return {
    jurisdictionId,
    bodyId,
    sourceId: SENAT_SOURCE_ID,
    externalId: slug,
    title: slug.toUpperCase(),
    longTitle: r.titre,
    stage: statusToStage(status),
    rawStatus: status,
    introducedDate: introduced,
    lastActionDate: lastAction,
    lastActionText: status,
    sponsorName: null,
    sponsorParty: null,
    url: r.url,
    textUrl: null,
    voteYes: null,
    voteNo: null,
    voteAbstain: null,
    raw: r,
  };
}

/* ---------- public entrypoint ---------- */

export async function fetchFRBillsForSync(opts: {
  jurisdictionId: string;
  db: NeonHttpDatabase<typeof schema>;
  /** Per-chamber cap. Total returned ≤ 2 × limit. Default 50/each. */
  limit?: number;
}): Promise<BillFetchBatch> {
  const limit = opts.limit ?? 50;

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
  const lowerBodyId = bodyByChamber.get("lower") ?? null;
  const upperBodyId = bodyByChamber.get("upper") ?? null;

  const [an, senat] = await Promise.all([fetchAN(limit), fetchSenat(limit)]);

  const anDrafts = an.rows
    .map((d) => anDraft(d, opts.jurisdictionId, lowerBodyId))
    .filter((d): d is BillIngestDraft => d !== null);
  const senatDrafts = senat.rows
    .map((r) => senatDraft(r, opts.jurisdictionId, upperBodyId))
    .filter((d): d is BillIngestDraft => d !== null);

  const seen = new Set<string>();
  const out: BillIngestDraft[] = [];
  for (const d of [...anDrafts, ...senatDrafts]) {
    const key = `${d.sourceId}:${d.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  const anOutcome = finalizeBillSourceMapping(
    an.outcome,
    out.filter((draft) => draft.sourceId === AN_SOURCE_ID).length,
    {
      zeroMappedError: `${an.rows.length} Assemblée dossier(s) produced zero mappable bill drafts`,
    },
  );
  const senatOutcome = finalizeBillSourceMapping(
    senat.outcome,
    out.filter((draft) => draft.sourceId === SENAT_SOURCE_ID).length,
    {
      zeroMappedError: `${senat.rows.length} Sénat record(s) produced zero mappable bill drafts`,
    },
  );
  return {
    drafts: out,
    sourceOutcomes: [anOutcome, senatOutcome],
  };
}
