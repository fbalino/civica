import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { sparqlQuery } from "@/lib/data/wikidata";
import {
  OFFICEHOLDER_QUERY,
  resolveOfficeholderBindings,
  type PrincipalOfficeholderRole,
} from "@/lib/factbook/officeholders-sync";
import { getWorldLeadersDirectory } from "@/lib/leaders/query";

const OUTPUT = "plan/evidence/ATL-010/production-refresh-plan.json";
const capture = process.argv.includes("--capture");

function semanticHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function key(stateQid: string, role: PrincipalOfficeholderRole): string {
  return `${stateQid}\u001f${role}`;
}

async function main() {
  const [bindings, currentRows] = await Promise.all([
    sparqlQuery(OFFICEHOLDER_QUERY),
    getWorldLeadersDirectory(),
  ]);
  const states = resolveOfficeholderBindings(bindings);
  const expected = new Map<
    string,
    {
      stateQid: string;
      stateName: string;
      role: PrincipalOfficeholderRole;
      personQids: string[];
      personNames: string[];
    }
  >();
  for (const state of states) {
    for (const [role, rows] of [
      ["head_of_state", state.headOfState],
      ["head_of_government", state.headOfGovernment],
    ] as const) {
      expected.set(key(state.stateQid, role), {
        stateQid: state.stateQid,
        stateName: state.stateName,
        role,
        personQids: rows.map((row) => row.personQid).sort(),
        personNames: rows.map((row) => row.personName).sort(),
      });
    }
  }

  const current = new Map<
    string,
    {
      stateQid: string;
      stateName: string;
      role: PrincipalOfficeholderRole;
      personQids: string[];
      personNames: string[];
    }
  >();
  const currentRowsWithoutSourceIdentity = currentRows
    .filter(
      (row) =>
        !row.jurisdictionWikidataQid || !row.personWikidataQid,
    )
    .map((row) => ({
      jurisdiction: row.jurisdictionName,
      role: row.officeType,
      person: row.personName,
      termId: row.termId,
    }));
  for (const row of currentRows) {
    if (!row.jurisdictionWikidataQid || !row.personWikidataQid) continue;
    const mapKey = key(row.jurisdictionWikidataQid, row.officeType);
    const existing =
      current.get(mapKey) ??
      {
        stateQid: row.jurisdictionWikidataQid,
        stateName: row.jurisdictionName,
        role: row.officeType,
        personQids: [],
        personNames: [],
      };
    existing.personQids.push(row.personWikidataQid);
    existing.personNames.push(row.personName);
    existing.personQids.sort();
    existing.personNames.sort();
    current.set(mapKey, existing);
  }

  const discrepancies = [...new Set([...expected.keys(), ...current.keys()])]
    .sort()
    .flatMap((mapKey) => {
      const expectedRow = expected.get(mapKey);
      const currentRow = current.get(mapKey);
      const expectedQids = expectedRow?.personQids ?? [];
      const currentQids = currentRow?.personQids ?? [];
      if (JSON.stringify(expectedQids) === JSON.stringify(currentQids)) {
        return [];
      }
      return [
        {
          stateQid: expectedRow?.stateQid ?? currentRow!.stateQid,
          jurisdiction: expectedRow?.stateName ?? currentRow!.stateName,
          role: expectedRow?.role ?? currentRow!.role,
          retainedPeople: currentRow?.personNames ?? [],
          retainedPersonQids: currentQids,
          sourceSelectedPeople: expectedRow?.personNames ?? [],
          sourceSelectedPersonQids: expectedQids,
        },
      ];
    });
  const ambiguousRoles = states.flatMap((state) =>
    state.ambiguousRoles.map((role) => ({
      stateQid: state.stateQid,
      jurisdiction: state.stateName,
      role,
    })),
  );
  // An upstream-ambiguous role (multiple un-ended normal-rank claims) is a
  // disclosed exclusion, not a publication block — provided nothing is
  // published for it. A retained current row under an ambiguous role would be
  // an unverifiable claim and keeps the release blocked.
  const ambiguousRolesWithRetainedRows = ambiguousRoles.filter((row) =>
    current.has(key(row.stateQid, row.role)),
  );
  const sourceSelectedRecordCount = [...expected.values()].reduce(
    (sum, row) => sum + row.personQids.length,
    0,
  );
  const withoutHash = {
    schemaVersion: "civica-leader-directory-refresh-plan/v1",
    taskId: "ATL-010",
    generatedAt: new Date().toISOString(),
    mode: "zero_write",
    officialRankSemanticsVerifiedAt: "2026-07-23",
    officialRankSemanticsUrl:
      "https://www.wikidata.org/wiki/Help:Ranking",
    queryContract:
      "Wikidata truthy-rank P35/P6 statements with no P582 end qualifier; multiple preferred statements retained, multiple un-ended normal statements fail closed",
    retainedReleaseId: (
      JSON.parse(
        readFileSync("data/leaders-directory-release.v1.json", "utf8"),
      ) as { releaseId: string }
    ).releaseId,
    sourceBindings: bindings.length,
    sourceStates: states.length,
    sourceSelectedRecordCount,
    retainedRecordCount: currentRows.length,
    discrepancyCount: discrepancies.length,
    ambiguousRoleCount: ambiguousRoles.length,
    ambiguousRolesWithRetainedRowsCount: ambiguousRolesWithRetainedRows.length,
    currentRowsWithoutSourceIdentityCount:
      currentRowsWithoutSourceIdentity.length,
    releaseReady:
      discrepancies.length === 0 &&
      ambiguousRolesWithRetainedRows.length === 0 &&
      currentRowsWithoutSourceIdentity.length === 0,
    requiredAction:
      "Owner-authorized production run of sync:wikidata with a named Atlas release, followed by recapture, live directory validation, browser QA, and publication-status activation.",
    discrepancies,
    ambiguousRoles,
    ambiguousRolesWithRetainedRows,
    currentRowsWithoutSourceIdentity,
  };
  const artifact = {
    ...withoutHash,
    semanticSha256: semanticHash(withoutHash),
  };

  if (capture) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(
      `WROTE ${OUTPUT} — ${artifact.discrepancyCount} roster discrepancies, ${artifact.ambiguousRoleCount} ambiguous roles, releaseReady=${artifact.releaseReady}.`,
    );
  } else {
    console.log(JSON.stringify(artifact, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
