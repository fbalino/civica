import assert from "node:assert/strict";
import test from "node:test";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import type { BillIngestDraft } from "../types";
import { billIngestErrors } from "../upsert";
import { fetchUSBillsForSync } from "./us-congress";
import { fetchUKBillsForSync } from "./uk-parliament";
import { fetchCABillsForSync } from "./legisinfo-ca";
import { fetchDEBillsForSync } from "./bundestag-dip";
import { fetchBRBillsForSync } from "./camara-senado-br";
import { fetchFRBillsForSync } from "./an-senat-fr";

type Db = NeonHttpDatabase<typeof schema>;
const jurisdictionId = "11111111-1111-4111-8111-111111111111";

function bodyDb(): Db {
  return {
    select: () => ({
      from: () => ({
        where: async () => [
          { id: "22222222-2222-4222-8222-222222222222", chamberType: "lower" },
          { id: "33333333-3333-4333-8333-333333333333", chamberType: "upper" },
        ],
      }),
    }),
  } as unknown as Db;
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function validateDrafts(rows: BillIngestDraft[]): void {
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.deepEqual(billIngestErrors({ ...row, summary: row.summary ?? null }), []);
  }
}

test("all six bills adapters parse stable source-shaped fixtures", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.congress.gov")) return json({ bills: [{ congress: 119, type: "HR", number: 1, title: "Fixture Act", introducedDate: "2026-07-01", latestAction: { text: "Referred to committee", actionDate: "2026-07-10" } }] });
    if (url.includes("bills-api.parliament.uk")) return json({ items: [{ billId: 101, shortTitle: "Fixture Bill", longTitle: "A UK fixture bill", lastUpdate: "2026-07-10T12:00:00Z", introducedSittingDate: "2026-07-01", currentStage: { description: "Committee stage" } }] });
    if (url.includes("parl.ca/legisinfo")) return json([{ BillId: 201, BillNumberFormatted: "C-1", LongTitleEn: "A Canadian fixture bill", CurrentStatusEn: "At committee", LatestActivityEn: "Committee referral", LatestActivityDateTime: "2026-07-10T12:00:00Z", PassedHouseFirstReadingDateTime: "2026-07-01T12:00:00Z", OriginatingChamberId: 1, ParlSessionCode: "45-1" }]);
    if (url.includes("search.dip.bundestag.de")) return json({ documents: [{ id: "301", titel: "Deutscher Testentwurf", beratungsstand: "Ausschussberatung", datum: "2026-07-01", aktualisiert: "2026-07-10", gesta: "C001" }] });
    if (url.includes("dadosabertos.camara")) return json({ dados: [{ id: 401, siglaTipo: "PL", numero: 1, ano: 2026, ementa: "Projeto de teste" }] });
    if (url.includes("legis.senado")) return json({ ListaMateriasAtualizadas: { Materias: { Materia: { IdentificacaoMateria: { CodigoMateria: "402", SiglaSubtipoMateria: "PL", NumeroMateria: "2", AnoMateria: "2026" }, DadosBasicosMateria: { EmentaMateria: "Projeto do Senado", DataApresentacao: "2026-07-01" }, AtualizacoesRecentes: { Atualizacao: [{ DataUltimaAtualizacao: "2026-07-10" }] } } } } });
    if (url.includes("assemblee-nationale")) return new Response("", { status: 503 });
    if (url.includes("data.senat.fr")) {
      const csv = 'titre;type;date;url;etat;decision;dateDecision;datePromulgation;numeroLoi;themes\n"Projet test";"Projet";"01/07/2026";"https://www.senat.fr/dossier-legislatif/ppl26-1.html";"Commission";"";"";"";"";"Institutions"';
      return new Response(csv, { status: 200 });
    }
    throw new Error(`Unexpected fixture URL: ${url}`);
  };

  try {
    const db = bodyDb();
    const adapters = [
      () => fetchUSBillsForSync({ jurisdictionId, limit: 1 }),
      () => fetchUKBillsForSync({ jurisdictionId, limit: 1 }),
      () => fetchCABillsForSync({ jurisdictionId, db, limit: 1 }),
      () => fetchDEBillsForSync({ jurisdictionId, db, limit: 1 }),
      () => fetchBRBillsForSync({ jurisdictionId, db, limit: 1 }),
      () => fetchFRBillsForSync({ jurisdictionId, db, limit: 1 }),
    ];
    for (const adapter of adapters) {
      const first = await adapter();
      const second = await adapter();
      assert.deepEqual(second, first);
      validateDrafts(first);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
