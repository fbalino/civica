/**
 * Brazil — merged adapter for the two chambers of Congresso Nacional:
 *   - Câmara dos Deputados (`camara_br`):  REST JSON  /api/v2/proposicoes
 *   - Senado Federal       (`senado_br`):  REST JSON  /materia/atualizadas
 *
 * Both feeds return Portuguese titles. The shared summariser produces
 * an English plain-language summary at sync time.
 *
 * Resilience: each chamber fetch is wrapped in try/catch — if one API
 * is down, the other still ships. The Câmara API has been observed to
 * return upstream-504 timeouts at peak load, so this is load-bearing.
 *
 * `bodyId` is resolved from `governmentBodies.chamber_type`:
 *   - "lower" → Câmara dos Deputados
 *   - "upper" → Senado Federal
 *
 * License: open per LAI 12.527/2011 (Brazil's Access to Information
 * law). Both chambers publish the data without a more restrictive
 * licence.
 */

import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { governmentBodies } from "@/lib/db/schema";
import type { BillIngestDraft } from "../types";
import { statusToStage } from "../stage";

const CAMARA_SOURCE_ID = "camara_br";
const SENADO_SOURCE_ID = "senado_br";

/* ---------- Câmara (lower house) ---------- */

interface CamaraRaw {
  id?: number;
  uri?: string;
  siglaTipo?: string;
  numero?: number;
  ano?: number;
  ementa?: string;
}
interface CamaraResponse {
  dados?: CamaraRaw[];
}

async function fetchCamara(limit: number): Promise<CamaraRaw[]> {
  // The /proposicoes endpoint requires a date filter or specific
  // ordering; "ordem=DESC, ordenarPor=id" returns the freshest IDs.
  const url = `https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PL,PEC,PLP,PDL&itens=${limit}&ordem=DESC&ordenarPor=id`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "civica-bills-sync/1.0 (https://civicaatlas.org)",
      },
      // 60s — Câmara is occasionally slow.
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[bills.br] Câmara fetch ${res.status}; skipping`);
      return [];
    }
    const json = (await res.json()) as CamaraResponse;
    return json.dados ?? [];
  } catch (err) {
    console.warn(
      `[bills.br] Câmara fetch failed: ${err instanceof Error ? err.message : err}; skipping`,
    );
    return [];
  }
}

/* ---------- Senado (upper house) ---------- */

interface SenadoMateria {
  IdentificacaoMateria?: {
    CodigoMateria?: string;
    SiglaSubtipoMateria?: string;
    NumeroMateria?: string;
    AnoMateria?: string;
    DescricaoIdentificacaoMateria?: string;
  };
  DadosBasicosMateria?: {
    EmentaMateria?: string;
    DataApresentacao?: string;
  };
  AtualizacoesRecentes?: {
    Atualizacao?: Array<{
      InformacaoAtualizada?: string;
      DataUltimaAtualizacao?: string;
    }>;
  };
}
interface SenadoResponse {
  ListaMateriasAtualizadas?: {
    Materias?: { Materia?: SenadoMateria | SenadoMateria[] };
  };
}

/** Subtipo codes that represent actual bills/legislation we want to
 * surface, filtered out of REQ/RQS/etc which are administrative. */
const SENADO_BILL_TYPES = new Set([
  "PL",
  "PEC",
  "PLP",
  "PLN",
  "PDL",
  "PDS",
  "PRS",
  "MPV",
  "PLC",
]);

async function fetchSenado(): Promise<SenadoMateria[]> {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  // Pull anything updated in the last 30 days. The API caps numdias
  // at 30 (returns 400 for higher values). The response includes
  // mixed material types; we filter to bill subtypes below.
  const url = `https://legis.senado.leg.br/dadosabertos/materia/atualizadas?ano=${ano}&mes=${mes}&numdias=30`;
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
      console.warn(`[bills.br] Senado fetch ${res.status}; skipping`);
      return [];
    }
    const json = (await res.json()) as SenadoResponse;
    const m = json.ListaMateriasAtualizadas?.Materias?.Materia;
    if (!m) return [];
    return Array.isArray(m) ? m : [m];
  } catch (err) {
    console.warn(
      `[bills.br] Senado fetch failed: ${err instanceof Error ? err.message : err}; skipping`,
    );
    return [];
  }
}

/* ---------- shape helpers ---------- */

function camaraDraft(
  b: CamaraRaw,
  jurisdictionId: string,
  bodyId: string | null,
): BillIngestDraft | null {
  if (!b.id) return null;
  const identifier =
    b.siglaTipo && b.numero != null && b.ano != null
      ? `${b.siglaTipo} ${b.numero}/${b.ano}`
      : `Proposição ${b.id}`;
  const formal = b.ementa?.trim() || identifier;
  const today = new Date().toISOString().slice(0, 10);
  return {
    jurisdictionId,
    bodyId,
    sourceId: CAMARA_SOURCE_ID,
    externalId: `cd-${b.id}`,
    title: identifier,
    longTitle: formal !== identifier ? formal : null,
    stage: statusToStage(null),
    rawStatus: null,
    introducedDate: null,
    // Câmara list endpoint doesn't expose a "last update" field; use
    // today as a conservative ceiling so the row sorts to the top.
    lastActionDate: today,
    lastActionText: null,
    sponsorName: null,
    sponsorParty: null,
    url: `https://www.camara.leg.br/propostas-legislativas/${b.id}`,
    textUrl: null,
    voteYes: null,
    voteNo: null,
    voteAbstain: null,
    raw: b,
  };
}

function senadoDraft(
  m: SenadoMateria,
  jurisdictionId: string,
  bodyId: string | null,
): BillIngestDraft | null {
  const id = m.IdentificacaoMateria?.CodigoMateria;
  const sub = m.IdentificacaoMateria?.SiglaSubtipoMateria;
  if (!id || !sub || !SENADO_BILL_TYPES.has(sub)) return null;

  const identifier =
    m.IdentificacaoMateria?.DescricaoIdentificacaoMateria?.trim() ||
    (m.IdentificacaoMateria?.NumeroMateria && m.IdentificacaoMateria?.AnoMateria
      ? `${sub} ${parseInt(m.IdentificacaoMateria.NumeroMateria, 10)}/${m.IdentificacaoMateria.AnoMateria}`
      : `${sub} ${id}`);
  const formal = m.DadosBasicosMateria?.EmentaMateria?.trim() || identifier;

  const updates = m.AtualizacoesRecentes?.Atualizacao ?? [];
  const lastUpdate = updates
    .map((u) => u.DataUltimaAtualizacao ?? "")
    .filter(Boolean)
    .sort()
    .pop();
  const lastAction =
    (lastUpdate ?? "").slice(0, 10) ||
    m.DadosBasicosMateria?.DataApresentacao?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  return {
    jurisdictionId,
    bodyId,
    sourceId: SENADO_SOURCE_ID,
    externalId: `sf-${id}`,
    title: identifier,
    longTitle: formal !== identifier ? formal : null,
    stage: statusToStage(null),
    rawStatus: null,
    introducedDate: m.DadosBasicosMateria?.DataApresentacao?.slice(0, 10) ?? null,
    lastActionDate: lastAction,
    lastActionText: null,
    sponsorName: null,
    sponsorParty: null,
    url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${id}`,
    textUrl: null,
    voteYes: null,
    voteNo: null,
    voteAbstain: null,
    raw: m,
  };
}

/* ---------- public entrypoint ---------- */

export async function fetchBRBillsForSync(opts: {
  jurisdictionId: string;
  db: NeonHttpDatabase<typeof schema>;
  /** Per-chamber cap. Total returned ≤ 2 × limit. Default 50/each. */
  limit?: number;
}): Promise<BillIngestDraft[]> {
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

  // Run both fetches in parallel — neither depends on the other.
  const [camara, senado] = await Promise.all([
    fetchCamara(limit),
    fetchSenado(),
  ]);

  const camaraDrafts = camara
    .map((b) => camaraDraft(b, opts.jurisdictionId, lowerBodyId))
    .filter((d): d is BillIngestDraft => d !== null);

  const senadoDrafts = senado
    .map((m) => senadoDraft(m, opts.jurisdictionId, upperBodyId))
    .filter((d): d is BillIngestDraft => d !== null)
    .slice(0, limit);

  // Dedupe by `${sourceId}:${externalId}` — chambers share the
  // namespace prefix so collisions across feeds are vanishingly rare,
  // but a defensive de-dupe protects against retries within a single
  // run.
  const seen = new Set<string>();
  const out: BillIngestDraft[] = [];
  for (const d of [...camaraDrafts, ...senadoDrafts]) {
    const key = `${d.sourceId}:${d.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}
