/**
 * DAT-038 — `bill-last-action-date/v1` source-shaped fixtures.
 *
 * Every fixture gives the record-modified fields (Congress.gov `updateDate`,
 * UK `lastUpdate`, DIP `aktualisiert`, Senado `DataUltimaAtualizacao`) the
 * retrieval day, as production feeds do, and gives the publisher's
 * legislative-step fields a different, earlier date. The former adapters
 * stored the modified date, the retrieval day, or the introduction date as
 * the "last action"; each assertion below fails on that behaviour.
 */
import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";
import type { BillIngestDraft } from "../types";
import { billIngestErrors } from "../upsert";
import { BILL_LAST_ACTION_REASONS } from "../last-action";
import { fetchUSBillsForSync } from "./us-congress";
import { fetchUKBillsForSync } from "./uk-parliament";
import { fetchCABillsForSync } from "./legisinfo-ca";
import { fetchDEBillsForSync } from "./bundestag-dip";
import { fetchBRBillsForSync } from "./camara-senado-br";
import { fetchFRBillsForSync } from "./an-senat-fr";

type Db = NeonHttpDatabase<typeof schema>;
const jurisdictionId = "11111111-1111-4111-8111-111111111111";
/** Pinned retrieval time. Modified-date fields below equal this day. */
const retrievedAt = new Date("2026-09-28T12:00:00Z");
const RETRIEVAL_DAY = "2026-09-28";

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

async function withFetch<T>(
  handler: (url: string) => Response,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => handler(String(input));
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function drafts(result: BillIngestDraft[] | { drafts: BillIngestDraft[] }) {
  return Array.isArray(result) ? result : result.drafts;
}

function byExternalId(rows: BillIngestDraft[], externalId: string) {
  const row = rows.find((draft) => draft.externalId === externalId);
  assert.ok(row, `expected a draft for ${externalId}`);
  return row;
}

/** Compare every draft's date first, so a failure shows the stored dates. */
function assertDates(
  rows: BillIngestDraft[],
  expected: Record<string, string | null>,
) {
  assert.deepEqual(
    Object.fromEntries(
      rows.map((row) => [row.externalId, row.lastActionDate] as const),
    ),
    expected,
  );
}

function assertObserved(row: BillIngestDraft, date: string) {
  assert.equal(row.lastActionDate, date, `${row.externalId} last action`);
  assert.equal(row.lastActionDateStatus, "observed");
  assert.equal(row.lastActionDateReason, null);
}

function assertAbsent(
  row: BillIngestDraft,
  status: "missing" | "not_observed",
  reason: string,
) {
  assert.equal(
    row.lastActionDate,
    null,
    `${row.externalId} must not carry a substituted last-action date`,
  );
  assert.equal(row.lastActionDateStatus, status);
  assert.equal(row.lastActionDateReason, reason);
}

/** No draft may carry the retrieval day unless a publisher step is dated so. */
function assertNoRetrievalDay(rows: BillIngestDraft[]) {
  const realToday = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    assert.notEqual(row.lastActionDate, RETRIEVAL_DAY, row.externalId);
    assert.notEqual(row.lastActionDate, realToday, row.externalId);
    assert.deepEqual(
      billIngestErrors({ ...row, summary: row.summary ?? null }),
      [],
      row.externalId,
    );
  }
}

test("Congress.gov: latestAction.actionDate only, never updateDate", async () => {
  const rows = drafts(
    await withFetch(
      () =>
        json({
          bills: [
            {
              congress: 119,
              type: "HR",
              number: 1,
              title: "Acted-on fixture",
              updateDate: `${RETRIEVAL_DAY}T08:15:00Z`,
              latestAction: { text: "Referred", actionDate: "2026-07-10" },
            },
            {
              congress: 119,
              type: "S",
              number: 2,
              title: "Record without a latest action",
              updateDate: RETRIEVAL_DAY,
            },
          ],
        }),
      () => fetchUSBillsForSync({ jurisdictionId, limit: 2, retrievedAt }),
    ),
  );
  assertDates(rows, { "119-hr-1": "2026-07-10", "119-s-2": null });
  assertObserved(byExternalId(rows, "119-hr-1"), "2026-07-10");
  assertAbsent(
    byExternalId(rows, "119-s-2"),
    "missing",
    BILL_LAST_ACTION_REASONS.usNoLatestAction,
  );
  assertNoRetrievalDay(rows);
});

test("UK Bills API: latest past sitting of the current stage, never lastUpdate", async () => {
  const rows = drafts(
    await withFetch(
      () =>
        json({
          items: [
            {
              billId: 101,
              shortTitle: "Sat fixture",
              lastUpdate: `${RETRIEVAL_DAY}T10:00:00`,
              currentStage: {
                description: "Committee stage",
                stageSittings: [
                  { date: "2026-07-01T00:00:00" },
                  { date: "2026-07-08T00:00:00" },
                  // Scheduled, not yet taken.
                  { date: "2026-10-20T00:00:00" },
                ],
              },
            },
            {
              billId: 102,
              shortTitle: "Awaiting sitting fixture",
              lastUpdate: `${RETRIEVAL_DAY}T10:00:00`,
              currentStage: { description: "2nd reading", stageSittings: [] },
            },
          ],
        }),
      () => fetchUKBillsForSync({ jurisdictionId, limit: 2, retrievedAt }),
    ),
  );
  assertDates(rows, { "101": "2026-07-08", "102": null });
  assertObserved(byExternalId(rows, "101"), "2026-07-08");
  assertAbsent(
    byExternalId(rows, "102"),
    "not_observed",
    BILL_LAST_ACTION_REASONS.ukNoSitting,
  );
  assertNoRetrievalDay(rows);
});

test("Bundestag DIP: datum (latest document), never aktualisiert; no introduced date", async () => {
  const originalKey = process.env.BUNDESTAG_API_KEY;
  process.env.BUNDESTAG_API_KEY = "fixture-key";
  try {
    const rows = drafts(
      await withFetch(
        () =>
          json({
            cursor: "done",
            documents: [
              {
                id: "301",
                titel: "Dokumentierter Entwurf",
                vorgangstyp: "Gesetzgebung",
                beratungsstand: "Beschlussempfehlung liegt vor",
                datum: "2026-06-30",
                aktualisiert: `${RETRIEVAL_DAY}T09:00:00+02:00`,
              },
              {
                id: "302",
                titel: "Entwurf ohne Dokumentdatum",
                vorgangstyp: "Gesetzgebung",
                aktualisiert: `${RETRIEVAL_DAY}T09:00:00+02:00`,
              },
            ],
          }),
        () =>
          fetchDEBillsForSync({
            jurisdictionId,
            db: bodyDb(),
            limit: 2,
            retrievedAt,
          }),
      ),
    );
    assertDates(rows, { "301": "2026-06-30", "302": null });
    const documented = byExternalId(rows, "301");
    assertObserved(documented, "2026-06-30");
    assert.equal(
      documented.introducedDate,
      null,
      "datum dates the latest document, not the introduction",
    );
    assertAbsent(
      byExternalId(rows, "302"),
      "not_observed",
      BILL_LAST_ACTION_REASONS.dipNoDocument,
    );
    assertNoRetrievalDay(rows);
  } finally {
    if (originalKey === undefined) delete process.env.BUNDESTAG_API_KEY;
    else process.env.BUNDESTAG_API_KEY = originalKey;
  }
});

test("LEGISinfo: latest dated bill event; an undated bill stays as a typed absence", async () => {
  const base = {
    StatusNameEn: "At committee",
    OriginatingChamberOrganizationId: 1,
    ParliamentNumber: 45,
    SessionNumber: 1,
  };
  const result = await withFetch(
    () =>
      json([
        {
          ...base,
          Id: 201,
          NumberCode: "C-1",
          LongTitleEn: "Dated fixture",
          PassedHouseFirstReadingDateTime: "2026-06-01T14:00:00",
          LatestBillEventDateTime: "2026-06-12T15:30:00",
        },
        {
          ...base,
          Id: 202,
          NumberCode: "C-2",
          LongTitleEn: "Undated fixture",
        },
      ]),
    () =>
      fetchCABillsForSync({
        jurisdictionId,
        db: bodyDb(),
        limit: 2,
        retrievedAt,
      }),
  );
  const rows = drafts(result);
  assertDates(rows, { "201": "2026-06-12", "202": null });
  assert.equal(result.sourceOutcomes[0]?.status, "success");
  assertObserved(byExternalId(rows, "201"), "2026-06-12");
  assertAbsent(
    byExternalId(rows, "202"),
    "not_observed",
    BILL_LAST_ACTION_REASONS.legisinfoNoEvent,
  );
  assertNoRetrievalDay(rows);
});

test("Câmara and Senado: no action date in either feed, never today or DataUltimaAtualizacao", async () => {
  const result = await withFetch(
    (url) => {
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
                  DataApresentacao: "2026-05-05",
                },
                AtualizacoesRecentes: {
                  Atualizacao: [
                    {
                      InformacaoAtualizada: "Tramitação",
                      DataUltimaAtualizacao: `${RETRIEVAL_DAY} 10:00:00`,
                    },
                  ],
                },
              },
            },
          },
        });
      throw new Error(`Unexpected fixture URL: ${url}`);
    },
    () =>
      fetchBRBillsForSync({
        jurisdictionId,
        db: bodyDb(),
        limit: 1,
      }),
  );
  const rows = drafts(result);
  assertDates(rows, { "cd-401": null, "sf-402": null });
  assertAbsent(
    byExternalId(rows, "cd-401"),
    "missing",
    BILL_LAST_ACTION_REASONS.camaraListFeed,
  );
  const senado = byExternalId(rows, "sf-402");
  assertAbsent(senado, "missing", BILL_LAST_ACTION_REASONS.senadoUpdatedFeed);
  assert.equal(senado.introducedDate, "2026-05-05");
  assertNoRetrievalDay(rows);
});

function anArchive(dossiers: Record<string, unknown>[]): ArrayBuffer {
  const zip = new AdmZip();
  dossiers.forEach((dossierParlementaire, index) =>
    zip.addFile(
      `dossier-${index}.json`,
      Buffer.from(JSON.stringify({ dossierParlementaire })),
    ),
  );
  const archive = zip.toBuffer();
  return archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
}

function anDossier(uid: string, acts: unknown): Record<string, unknown> {
  return {
    uid,
    legislature: "17",
    "@xsi:type": "DossierLegislatif_Type",
    titreDossier: { titre: `Dossier ${uid}`, titreChemin: uid.toLowerCase() },
    procedureParlementaire: { libelle: "Projet de loi" },
    actesLegislatifs: acts,
  };
}

test("Assemblée and Sénat: dated acts and final steps only, never today or the deposit date", async () => {
  const archive = anArchive([
    anDossier("DLR5L17N1", {
      acteLegislatif: {
        dateActe: "2026-07-10T00:00:00.000+02:00",
        libelleActe: { libelleCourt: "Commission" },
      },
    }),
    anDossier("DLR5L17N2", {
      acteLegislatif: { libelleActe: { libelleCourt: "Sans date" } },
    }),
    anDossier("DLR5L17N3", {
      acteLegislatif: [
        {
          dateActe: "2026-06-01T00:00:00.000+02:00",
          libelleActe: { libelleCourt: "Dépôt" },
        },
        {
          // Scheduled after retrieval: not an action taken.
          dateActe: "2026-12-01T00:00:00.000+01:00",
          libelleActe: { libelleCourt: "Séance prévue" },
        },
      ],
    }),
  ]);
  const csv = [
    "titre;type;date;url;etat;decision;dateDecision;datePromulgation;numeroLoi;themes",
    '"Loi promulguée";"Projet";"01/02/2026";"http://www.senat.fr/dossier-legislatif/pjl25-1.html";"Promulgué";"Conforme";"10/03/2026";"14/03/2026";"2026-1";"Institutions"',
    '"Loi déférée";"Projet";"02/02/2026";"http://www.senat.fr/dossier-legislatif/pjl25-2.html";"Décision";"Conforme";"20/03/2026";"";"";"Institutions"',
    '"Proposition déposée";"Proposition";"03/02/2026";"http://www.senat.fr/dossier-legislatif/ppl25-3.html";"En navette";"";"";"";"";"Institutions"',
  ].join("\n");
  const result = await withFetch(
    (url) => {
      if (url.includes("assemblee-nationale"))
        return new Response(archive, { status: 200 });
      if (url.includes("data.senat.fr")) return new Response(csv, { status: 200 });
      throw new Error(`Unexpected fixture URL: ${url}`);
    },
    () =>
      fetchFRBillsForSync({
        jurisdictionId,
        db: bodyDb(),
        limit: 3,
        retrievedAt,
      }),
  );
  const rows = drafts(result);
  assertDates(rows, {
    DLR5L17N1: "2026-07-10",
    DLR5L17N2: null,
    DLR5L17N3: "2026-06-01",
    "pjl25-1": "2026-03-14",
    "pjl25-2": "2026-03-20",
    "ppl25-3": null,
  });
  assertObserved(byExternalId(rows, "DLR5L17N1"), "2026-07-10");
  assertAbsent(
    byExternalId(rows, "DLR5L17N2"),
    "not_observed",
    BILL_LAST_ACTION_REASONS.anNoAct,
  );
  assertObserved(byExternalId(rows, "DLR5L17N3"), "2026-06-01");
  assertObserved(byExternalId(rows, "pjl25-1"), "2026-03-14");
  assertObserved(byExternalId(rows, "pjl25-2"), "2026-03-20");
  const deposited = byExternalId(rows, "ppl25-3");
  assertAbsent(
    deposited,
    "not_observed",
    BILL_LAST_ACTION_REASONS.senatNoLaterStep,
  );
  assert.equal(deposited.introducedDate, "2026-02-03");
  assertNoRetrievalDay(rows);
});
