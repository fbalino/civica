import {
  selectCanonicalIncident,
  type IncidentCandidate,
  type IncidentResolutionFinding,
} from "./incident-resolution";

export interface IncidentMergeGroup {
  canonicalIncidentId: string;
  duplicateIncidentIds: string[];
  incidentIds: string[];
  findingKeys: string[];
}

/**
 * Collapse pairwise confirmed findings into deterministic connected groups.
 * The survivor is selected once across the full component so a transitive
 * duplicate chain can never merge an intermediate survivor twice.
 */
export function buildIncidentMergeGroups(
  candidates: readonly IncidentCandidate[],
  findings: readonly IncidentResolutionFinding[],
): IncidentMergeGroup[] {
  const byId = new Map(candidates.map((candidate) => [candidate.incidentId, candidate]));
  const confirmed = findings.filter(
    (finding) =>
      finding.disposition === "confirmed_merge" &&
      finding.candidateIds.length === 2,
  );
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  for (const finding of confirmed) {
    const [left, right] = finding.candidateIds;
    if (!byId.has(left) || !byId.has(right)) {
      throw new Error(`confirmed incident finding references an unknown candidate: ${finding.findingKey}`);
    }
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      const [first, second] = [leftRoot, rightRoot].sort();
      parent.set(second, first);
    }
  }

  const components = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    components.set(root, [...(components.get(root) ?? []), id]);
  }
  return [...components.values()]
    .map((ids) => {
      const incidentIds = [...new Set(ids)].sort();
      const canonicalIncidentId = selectCanonicalIncident(
        incidentIds.map((id) => byId.get(id)!),
      ).incidentId;
      const findingKeys = confirmed
        .filter((finding) =>
          finding.candidateIds.every((id) => incidentIds.includes(id)),
        )
        .map((finding) => finding.findingKey)
        .sort();
      return {
        canonicalIncidentId,
        duplicateIncidentIds: incidentIds.filter((id) => id !== canonicalIncidentId),
        incidentIds,
        findingKeys,
      };
    })
    .sort((left, right) =>
      left.canonicalIncidentId.localeCompare(right.canonicalIncidentId),
    );
}
