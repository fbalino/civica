import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import type { BillIngestDraft } from "../types";
import { runBillsSync } from "../sync";
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

function anFixtureArchive(
  dossierParlementaire: Record<string, unknown> = {
    uid: "DLR5L17N54085",
    legislature: "17",
    "@xsi:type": "DossierLegislatif_Type",
    titreDossier: {
      titre: "Projet de test",
      titreChemin: "projet_test",
    },
    procedureParlementaire: { libelle: "Projet de loi" },
    actesLegislatifs: {
      acteLegislatif: {
        dateActe: "2026-07-10",
        libelleActe: { libelleCourt: "Commission" },
      },
    },
  },
): ArrayBuffer {
  const zip = new AdmZip();
  zip.addFile(
    "fixture.json",
    Buffer.from(
      JSON.stringify({
        dossierParlementaire,
      }),
    ),
  );
  const archive = zip.toBuffer();
  return archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
}

test("all six bills adapters parse stable source-shaped fixtures", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const anArchive = anFixtureArchive();
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.congress.gov")) return json({ bills: [{ congress: 119, type: "HR", number: 1, title: "Fixture Act", introducedDate: "2026-07-01", latestAction: { text: "Referred to committee", actionDate: "2026-07-10" } }] });
    if (url.includes("bills-api.parliament.uk")) return json({ items: [{ billId: 101, shortTitle: "Fixture Bill", longTitle: "A UK fixture bill", lastUpdate: "2026-07-10T12:00:00Z", introducedSittingDate: "2026-07-01", currentStage: { description: "Committee stage" } }] });
    if (url.includes("parl.ca/legisinfo")) return json([{ BillId: 201, BillNumberFormatted: "C-1", LongTitleEn: "A Canadian fixture bill", CurrentStatusEn: "At committee", LatestActivityEn: "Committee referral", LatestActivityDateTime: "2026-07-10T12:00:00Z", PassedHouseFirstReadingDateTime: "2026-07-01T12:00:00Z", OriginatingChamberId: 1, ParlSessionCode: "45-1" }]);
    if (url.includes("search.dip.bundestag.de")) return json({ documents: [{ id: "301", titel: "Deutscher Testentwurf", beratungsstand: "Ausschussberatung", datum: "2026-07-01", aktualisiert: "2026-07-10", gesta: "C001" }] });
    if (url.includes("dadosabertos.camara")) return json({ dados: [{ id: 401, siglaTipo: "PL", numero: 1, ano: 2026, ementa: "Projeto de teste" }] });
    if (url.includes("legis.senado")) return json({ ListaMateriasAtualizadas: { Materias: { Materia: { IdentificacaoMateria: { CodigoMateria: "402", SiglaSubtipoMateria: "PL", NumeroMateria: "2", AnoMateria: "2026" }, DadosBasicosMateria: { EmentaMateria: "Projeto do Senado", DataApresentacao: "2026-07-01" }, AtualizacoesRecentes: { Atualizacao: [{ DataUltimaAtualizacao: "2026-07-10" }] } } } } });
    if (url.includes("assemblee-nationale")) return new Response(anArchive, { status: 200 });
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
      const firstResult = await adapter();
      const secondResult = await adapter();
      const first = Array.isArray(firstResult) ? firstResult : firstResult.drafts;
      const second = Array.isArray(secondResult) ? secondResult : secondResult.drafts;
      if (!Array.isArray(firstResult)) {
        assert.ok(
          firstResult.sourceOutcomes.every(
            (outcome) => outcome.status === "success",
          ),
        );
      }
      assert.deepEqual(second, first);
      validateDrafts(first);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(
  "France and Brazil fail the aggregate before writes when one chamber is unavailable",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    let writes = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("assemblee-nationale")) {
        return new Response("unavailable", { status: 503 });
      }
      if (url.includes("data.senat.fr")) {
        const csv =
          'titre;type;date;url;etat;decision;dateDecision;datePromulgation;numeroLoi;themes\n"Projet test";"Projet";"01/07/2026";"https://www.senat.fr/dossier-legislatif/ppl26-1.html";"Commission";"";"";"";"";"Institutions"';
        return new Response(csv, { status: 200 });
      }
      if (url.includes("dadosabertos.camara")) {
        return new Response("unavailable", { status: 504 });
      }
      if (url.includes("legis.senado")) {
        return json({
          ListaMateriasAtualizadas: {
            Materias: {
              Materia: {
                IdentificacaoMateria: {
                  CodigoMateria: "402",
                  SiglaSubtipoMateria: "PL",
                },
                DadosBasicosMateria: { EmentaMateria: "Projeto do Senado" },
              },
            },
          },
        });
      }
      throw new Error(`Unexpected fixture URL: ${url}`);
    };

    const db = bodyDb();
    const runnerSeams = {
      jurisdictionId,
      dryRun: false,
      readSummaries: async () => [],
      writeRows: async () => {
        writes++;
        throw new Error("write must remain unreachable");
      },
    };

    try {
      await assert.rejects(
        runBillsSync(db, {
          ...runnerSeams,
          jurisdictionSlug: "france",
          iso2: "FR",
          fetchDrafts: ({ jurisdictionId: id }) =>
            fetchFRBillsForSync({ jurisdictionId: id, db, limit: 1 }),
        }),
        /data_assemblee_fr \(HTTP 503\)/,
      );
      await assert.rejects(
        runBillsSync(db, {
          ...runnerSeams,
          jurisdictionSlug: "brazil",
          iso2: "BR",
          fetchDrafts: ({ jurisdictionId: id }) =>
            fetchBRBillsForSync({ jurisdictionId: id, db, limit: 1 }),
        }),
        /camara_br \(HTTP 504\)/,
      );
      assert.equal(writes, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
test(
  "France and Brazil reject nonempty structured feeds that map zero drafts",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    const unmappableAnArchive = anFixtureArchive({
      legislature: "17",
      "@xsi:type": "DossierLegislatif_Type",
      titreDossier: { titre: "Dossier without a stable identifier" },
    });
    let mode: "france" | "brazil" = "france";
    let writes = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("assemblee-nationale")) {
        return new Response(unmappableAnArchive, { status: 200 });
      }
      if (url.includes("data.senat.fr")) {
        return new Response(
          "titre;type;date;url;etat;decision;dateDecision;datePromulgation;numeroLoi;themes\n",
          { status: 200 },
        );
      }
      if (url.includes("dadosabertos.camara")) {
        return json({
          dados: [
            {
              siglaTipo: "PL",
              numero: 1,
              ano: 2026,
              ementa: "Structured row without the required id",
            },
          ],
        });
      }
      if (url.includes("legis.senado")) {
        return json({ ListaMateriasAtualizadas: {} });
      }
      throw new Error(`Unexpected ${mode} fixture URL: ${url}`);
    };

    const db = bodyDb();
    const runnerSeams = {
      jurisdictionId,
      readSummaries: async () => [],
      writeRows: async () => {
        writes++;
        throw new Error("write must remain unreachable");
      },
    };

    try {
      await assert.rejects(
        runBillsSync(db, {
          ...runnerSeams,
          jurisdictionSlug: "france",
          iso2: "FR",
          fetchDrafts: ({ jurisdictionId: id }) =>
            fetchFRBillsForSync({ jurisdictionId: id, db, limit: 1 }),
        }),
        /data_assemblee_fr \(1 Assemblée dossier\(s\) produced zero mappable bill drafts\)/,
      );
      mode = "brazil";
      await assert.rejects(
        runBillsSync(db, {
          ...runnerSeams,
          jurisdictionSlug: "brazil",
          iso2: "BR",
          fetchDrafts: ({ jurisdictionId: id }) =>
            fetchBRBillsForSync({ jurisdictionId: id, db, limit: 1 }),
        }),
        /camara_br \(1 Câmara record\(s\) produced zero mappable bill drafts\)/,
      );
      assert.equal(writes, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
test(
  "Brazil accepts a raw-empty chamber and an explicitly non-bill quiet period",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    let writes = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("dadosabertos.camara")) return json({ dados: [] });
      if (url.includes("legis.senado")) {
        return json({
          ListaMateriasAtualizadas: {
            Materias: {
              Materia: {
                IdentificacaoMateria: {
                  CodigoMateria: "quiet-1",
                  SiglaSubtipoMateria: "REQ",
                },
              },
            },
          },
        });
      }
      throw new Error(`Unexpected quiet-period fixture URL: ${url}`);
    };

    const db = bodyDb();
    try {
      const summary = await runBillsSync(db, {
        jurisdictionSlug: "brazil",
        jurisdictionId,
        iso2: "BR",
        fetchDrafts: ({ jurisdictionId: id }) =>
          fetchBRBillsForSync({ jurisdictionId: id, db, limit: 1 }),
        readSummaries: async () => [],
        writeRows: async () => {
          writes++;
          return {
            inserted: 0,
            updated: 0,
            unchanged: 0,
            wouldWrite: 0,
            dryRun: false,
            sourcesStamped: [],
          };
        },
      });
      assert.equal(summary.fetched, 0);
      assert.equal(writes, 1);
      assert.deepEqual(summary.sourcesStamped, []);
      assert.deepEqual(
        summary.sourceOutcomes.map((outcome) =>
          outcome.status === "success" ? outcome.emptyReason : undefined,
        ),
        ["upstream_returned_no_rows", "no_bill_records_in_period"],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
