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
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function validateDrafts(rows: BillIngestDraft[]): void {
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.deepEqual(
      billIngestErrors({ ...row, summary: row.summary ?? null }),
      [],
    );
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

test(
  "all six bills adapters parse stable source-shaped fixtures",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    const originalBundestagKey = process.env.BUNDESTAG_API_KEY;
    const anArchive = anFixtureArchive();
    process.env.BUNDESTAG_API_KEY = "fixture-key";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("api.congress.gov"))
        return json({
          bills: [
            {
              congress: 119,
              type: "HR",
              number: 1,
              title: "Fixture Act",
              introducedDate: "2026-07-01",
              latestAction: {
                text: "Referred to committee",
                actionDate: "2026-07-10",
              },
            },
          ],
        });
      if (url.includes("bills-api.parliament.uk"))
        return json({
          items: [
            {
              billId: 101,
              shortTitle: "Fixture Bill",
              longTitle: "A UK fixture bill",
              lastUpdate: "2026-07-10T12:00:00Z",
              introducedSittingDate: "2026-07-01",
              currentStage: { description: "Committee stage" },
            },
          ],
        });
      if (url.includes("parl.ca/legisinfo"))
        return json([
          {
            Id: 201,
            NumberCode: "C-1",
            LongTitleEn: "A Canadian fixture bill",
            StatusNameEn: "At committee",
            LatestBillEventTypeNameEn: "Committee referral",
            PassedHouseFirstReadingDateTime: "2026-07-01T12:00:00Z",
            PassedHouseSecondReadingDateTime: "2026-07-10T12:00:00Z",
            OriginatingChamberOrganizationId: 1,
            ParliamentNumber: 45,
            SessionNumber: 1,
            IsSessionOngoing: true,
          },
        ]);
      if (url.includes("search.dip.bundestag.de")) {
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          "ApiKey fixture-key",
        );
        assert.equal(new URL(url).searchParams.has("apikey"), false);
        return json({
          cursor: "done",
          documents: [
            {
              id: "301",
              titel: "Deutscher Testentwurf",
              beratungsstand: "Ausschussberatung",
              vorgangstyp: "Gesetzgebung",
              datum: "2026-07-01",
              aktualisiert: "2026-07-10",
              gesta: "C001",
            },
          ],
        });
      }
      if (url.includes("dadosabertos.camara"))
        return json({
          dados: [
            {
              id: 401,
              siglaTipo: "PL",
              numero: 1,
              ano: 2026,
              ementa: "Projeto de teste",
            },
          ],
        });
      if (url.includes("legis.senado"))
        return json({
          ListaMateriasAtualizadas: {
            Materias: {
              Materia: {
                IdentificacaoMateria: {
                  CodigoMateria: "402",
                  SiglaSubtipoMateria: "PL",
                  NumeroMateria: "2",
                  AnoMateria: "2026",
                },
                DadosBasicosMateria: {
                  EmentaMateria: "Projeto do Senado",
                  DataApresentacao: "2026-07-01",
                },
                AtualizacoesRecentes: {
                  Atualizacao: [{ DataUltimaAtualizacao: "2026-07-10" }],
                },
              },
            },
          },
        });
      if (url.includes("assemblee-nationale"))
        return new Response(anArchive, { status: 200 });
      if (url.includes("data.senat.fr")) {
        const csv =
          'titre;type;date;url;etat;decision;dateDecision;datePromulgation;numeroLoi;themes\n"Projet test";"Projet";"01/07/2026";"http://www.senat.fr/dossier-legislatif/ppl26-1.html";"Commission";"";"";"";"";"Institutions"';
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
        const first = Array.isArray(firstResult)
          ? firstResult
          : firstResult.drafts;
        const second = Array.isArray(secondResult)
          ? secondResult
          : secondResult.drafts;
        if (!Array.isArray(firstResult)) {
          assert.ok(
            firstResult.sourceOutcomes.every(
              (outcome) => outcome.status === "success",
            ),
          );
        }
        const senateDraft = first.find(
          (draft) => draft.sourceId === "senat_fr",
        );
        if (senateDraft) assert.match(senateDraft.url, /^https:\/\//);
        assert.deepEqual(second, first);
        validateDrafts(first);
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (originalBundestagKey === undefined)
        delete process.env.BUNDESTAG_API_KEY;
      else process.env.BUNDESTAG_API_KEY = originalBundestagKey;
    }
  },
);

test(
  "Canada rejects the retired LEGISinfo schema instead of writing empty identifiers",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      json([
        {
          BillId: 201,
          BillNumberFormatted: "C-1",
          LongTitleEn: "Retired schema fixture",
          LatestActivityDateTime: "2026-07-10T12:00:00Z",
        },
      ]);
    try {
      const result = await fetchCABillsForSync({
        jurisdictionId,
        db: bodyDb(),
        limit: 1,
      });
      assert.equal(result.drafts.length, 0);
      assert.deepEqual(result.sourceOutcomes, [
        {
          sourceId: "legisinfo_ca",
          status: "failed",
          fetched: 1,
          mapped: 0,
          code: "source_mapping_failed",
          error:
            "1 Canadian bill row(s) did not match the current LEGISinfo schema",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

test(
  "Germany requires a configured key before making a publisher request",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    const originalBundestagKey = process.env.BUNDESTAG_API_KEY;
    let requests = 0;
    delete process.env.BUNDESTAG_API_KEY;
    globalThis.fetch = async () => {
      requests++;
      throw new Error("publisher request must remain unreachable");
    };
    try {
      const result = await fetchDEBillsForSync({
        jurisdictionId,
        db: bodyDb(),
        limit: 1,
      });
      assert.equal(requests, 0);
      assert.equal(result.drafts.length, 0);
      assert.equal(result.sourceOutcomes[0]?.status, "failed");
      assert.equal(
        result.sourceOutcomes[0]?.status === "failed"
          ? result.sourceOutcomes[0].code
          : null,
        "source_configuration_missing",
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (originalBundestagKey === undefined)
        delete process.env.BUNDESTAG_API_KEY;
      else process.env.BUNDESTAG_API_KEY = originalBundestagKey;
    }
  },
);

test(
  "Germany paginates the official endpoint and filters legislative proceedings locally",
  { concurrency: false },
  async () => {
    const originalFetch = globalThis.fetch;
    const originalBundestagKey = process.env.BUNDESTAG_API_KEY;
    process.env.BUNDESTAG_API_KEY = "fixture-key";
    const urls: URL[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      urls.push(url);
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "ApiKey fixture-key",
      );
      assert.equal(url.searchParams.has("apikey"), false);
      assert.equal(url.searchParams.has("f.vorgangstyp"), false);
      if (!url.searchParams.has("cursor")) {
        return json({
          cursor: "page-2",
          documents: [
            {
              id: "admin-1",
              titel: "Nichtgesetzlicher Vorgang",
              vorgangstyp: "Geschäftsordnung",
              aktualisiert: "2026-07-11T10:00:00+02:00",
            },
          ],
        });
      }
      return json({
        cursor: "page-2",
        documents: [
          {
            id: "bill-1",
            titel: "Gesetzgebungsfixture",
            vorgangstyp: "Gesetzgebung",
            aktualisiert: "2026-07-10T10:00:00+02:00",
          },
        ],
      });
    };
    try {
      const result = await fetchDEBillsForSync({
        jurisdictionId,
        db: bodyDb(),
        limit: 1,
      });
      assert.equal(urls.length, 2);
      assert.equal(result.drafts.length, 1);
      assert.equal(result.drafts[0]?.externalId, "bill-1");
      assert.equal(result.sourceOutcomes[0]?.status, "success");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalBundestagKey === undefined)
        delete process.env.BUNDESTAG_API_KEY;
      else process.env.BUNDESTAG_API_KEY = originalBundestagKey;
    }
  },
);

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
        /data_assemblee_fr \(publisher temporarily unavailable \(HTTP 503\)\)/,
      );
      await assert.rejects(
        runBillsSync(db, {
          ...runnerSeams,
          jurisdictionSlug: "brazil",
          iso2: "BR",
          fetchDrafts: ({ jurisdictionId: id }) =>
            fetchBRBillsForSync({ jurisdictionId: id, db, limit: 1 }),
        }),
        /camara_br \(publisher temporarily unavailable \(HTTP 504\)\)/,
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
