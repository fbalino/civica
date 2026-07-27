export const PRINCIPAL_LEADER_OFFICE_TYPES = [
  "head_of_state",
  "head_of_government",
] as const;

export type PrincipalLeaderOfficeType =
  (typeof PRINCIPAL_LEADER_OFFICE_TYPES)[number];

export type LeadershipCapacity =
  | "acting"
  | "interim"
  | "caretaker"
  | "source_not_specified";

export interface LeaderDirectoryInput {
  termId: string;
  personId: string;
  personName: string;
  personWikidataQid: string | null;
  officeId: string;
  officeName: string;
  officeType: PrincipalLeaderOfficeType;
  startDate: string | null;
  jurisdictionId: string;
  jurisdictionName: string;
  jurisdictionSlug: string;
  jurisdictionWikidataQid: string | null;
  jurisdictionStatus: string;
  continent: string | null;
  sourceId: "wikidata";
  sourceUrl: string;
  sourceLicense: string;
  sourceRetrievedAt: string;
  sourceLastSyncAt: string | null;
}

export interface LeaderDirectoryRow extends LeaderDirectoryInput {
  leadershipCapacity: LeadershipCapacity;
  coLeadership: boolean;
  dualOffice: boolean;
}

export function leadershipCapacityFromSourceLabel(
  officeName: string,
): LeadershipCapacity {
  const normalized = officeName.normalize("NFKC").toLocaleLowerCase("en");
  if (/\bacting\b/.test(normalized)) return "acting";
  if (/\binterim\b/.test(normalized)) return "interim";
  if (/\bcaretaker\b/.test(normalized)) return "caretaker";
  return "source_not_specified";
}

/** Adds only evidence-supported ambiguity/capacity flags; it never infers a
 * conventional permanent office from the absence of an acting label. */
export function annotateLeaderDirectory(
  inputs: LeaderDirectoryInput[],
): LeaderDirectoryRow[] {
  const officeHolders = new Map<string, Set<string>>();
  const personOffices = new Map<string, Set<PrincipalLeaderOfficeType>>();
  for (const row of inputs) {
    const officeKey = `${row.jurisdictionId}\u001f${row.officeType}`;
    const personKey = `${row.jurisdictionId}\u001f${row.personId}`;
    const holders = officeHolders.get(officeKey) ?? new Set<string>();
    holders.add(row.personId);
    officeHolders.set(officeKey, holders);
    const heldTypes =
      personOffices.get(personKey) ?? new Set<PrincipalLeaderOfficeType>();
    heldTypes.add(row.officeType);
    personOffices.set(personKey, heldTypes);
  }
  return inputs.map((row) => ({
    ...row,
    leadershipCapacity: leadershipCapacityFromSourceLabel(row.officeName),
    coLeadership:
      (officeHolders.get(
        `${row.jurisdictionId}\u001f${row.officeType}`,
      )?.size ?? 0) > 1,
    dualOffice:
      (personOffices.get(
        `${row.jurisdictionId}\u001f${row.personId}`,
      )?.size ?? 0) > 1,
  }));
}

export function leaderDirectoryCountSummary(rows: LeaderDirectoryRow[]) {
  return {
    rows: rows.length,
    people: new Set(rows.map((row) => row.personId)).size,
    jurisdictions: new Set(rows.map((row) => row.jurisdictionId)).size,
    ambiguousCapacity: rows.filter(
      (row) => row.leadershipCapacity !== "source_not_specified",
    ).length,
    coLeadershipRows: rows.filter((row) => row.coLeadership).length,
    dualOfficeRows: rows.filter((row) => row.dualOffice).length,
  };
}
