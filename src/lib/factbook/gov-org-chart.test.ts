import assert from "node:assert/strict";
import test from "node:test";

import { buildGovStructure, type GovOfficeInput, type GovTermInput } from "./gov-org-chart";

const bodies = [
  { id: "body-exec", name: "Executive of Fixturia", branch: "executive", bodyType: "cabinet" },
  { id: "body-leg", name: "National Assembly", branch: "legislative", bodyType: "legislature" },
];

function office(
  id: string,
  name: string,
  officeType: string,
  displayOrder: number | null,
): GovOfficeInput {
  return { id, bodyId: "body-exec", name, officeType, displayOrder };
}

function term(officeId: string, personId: string, name: string, startDate: string | null): GovTermInput {
  return { term: { officeId, startDate }, person: { id: personId, name } };
}

function roles(structure: ReturnType<typeof buildGovStructure>) {
  return structure?.branches.find((branch) => branch.kind === "executive")?.roles ?? [];
}

test("roster offices show every holder of a multi-seat title, undated and in a stable order", () => {
  const structure = buildGovStructure({
    bodies,
    offices: [
      office("hos", "President of Fixturia", "head_of_state", null),
      office("state", "Min. of State", "cabinet", 3),
    ],
    currentTerms: [
      term("hos", "p-pres", "Ana Presidente", "2019-05-01"),
      term("state", "p-2", "Zed Zulu", "2022-09-15"),
      term("state", "p-1", "Amy Alpha", "2022-09-15"),
      term("state", "p-3", "Mo Mid", "2022-09-15"),
    ],
  });
  const ministers = roles(structure).filter((role) => role.title === "Min. of State");
  assert.deepEqual(
    ministers.map((role) => [role.id, role.holderName, role.sinceYear]),
    [
      ["office:state:p-1", "Amy Alpha", undefined],
      ["office:state:p-3", "Mo Mid", undefined],
      ["office:state:p-2", "Zed Zulu", undefined],
    ],
  );
  const president = roles(structure).find((role) => role.title === "President of Fixturia");
  assert.equal(president?.sinceYear, 2019);
  assert.equal(new Set(roles(structure).map((role) => role.id)).size, roles(structure).length);
});

test("an unlisted roster title with no holder is hidden; a listed vacant title stays", () => {
  const structure = buildGovStructure({
    bodies,
    offices: [
      office("hos", "President of Fixturia", "head_of_state", null),
      office("old", "Min. of Tourism", "cabinet", null),
      office("vacant", "Min. of Planning", "cabinet", 2),
    ],
    currentTerms: [term("hos", "p-pres", "Ana Presidente", "2019-05-01")],
  });
  const titles = roles(structure).map((role) => role.title);
  assert.equal(titles.includes("Min. of Tourism"), false);
  assert.equal(titles.includes("Min. of Planning"), true);
  assert.equal(
    roles(structure).find((role) => role.title === "Min. of Planning")?.vacant,
    true,
  );
});

test("head offices keep one deterministic card even with several stored holders", () => {
  const structure = buildGovStructure({
    bodies,
    offices: [office("co", "Co-Prince", "head_of_state", null)],
    currentTerms: [
      term("co", "p-b", "Bishop Beta", "2003-05-12"),
      term("co", "p-a", "Anne Alpha", "2017-05-14"),
    ],
  });
  const heads = roles(structure).filter((role) => role.title === "Co-Prince");
  assert.deepEqual(
    heads.map((role) => [role.id, role.holderName, role.sinceYear]),
    [["office:co", "Anne Alpha", 2017]],
  );
});

test("attribution distinguishes the CIA roster from unsourced legacy offices", () => {
  const roster = buildGovStructure({
    bodies,
    offices: [
      office("hos", "President of Fixturia", "head_of_state", null),
      office("fin", "Min. of Finance", "cabinet", 1),
    ],
    currentTerms: [
      term("hos", "p-pres", "Ana Presidente", "2019-05-01"),
      term("fin", "p-fin", "Fin Minister", null),
    ],
  });
  assert.equal(roster?.hasRosterOffices, true);
  assert.equal(roster?.hasUnsourcedOffices, false);
  assert.equal(roster?.executiveBodyId, "body-exec");
  assert.match(roster?.source ?? "", /CIA World Leaders roster/);

  const legacy = buildGovStructure({
    bodies,
    offices: [
      office("hos", "President of Usland", "head_of_state", null),
      office("sos", "Secretary of State", "cabinet", null),
    ],
    currentTerms: [
      term("hos", "p-pres", "Pat President", "2025-01-20"),
      term("sos", "p-sos", "Sam Secretary", "2025-01-20"),
    ],
  });
  assert.equal(legacy?.hasRosterOffices, false);
  assert.equal(legacy?.hasUnsourcedOffices, true);
  assert.equal(legacy?.source, "Officeholders from Wikidata");
  assert.equal(
    roles(legacy).find((role) => role.title === "Secretary of State")?.sinceYear,
    undefined,
  );
});
