import { createHash } from "node:crypto";

export const AUTHORSHIP_VERSION = "civica-authorship-contributions/v1" as const;

export const CONTRIBUTOR_ROLE_TAXONOMY = Object.freeze([
  { id: "conceptualization", label: "Conceptualization", definition: "Formulate the project's purpose, scope, and research direction." },
  { id: "methodology", label: "Methodology", definition: "Develop or approve research methods, models, and protocols." },
  { id: "data_curation", label: "Data curation", definition: "Acquire, document, reconcile, preserve, and maintain research data." },
  { id: "software", label: "Software", definition: "Design, implement, test, and maintain project software." },
  { id: "validation", label: "Validation", definition: "Verify reproducibility, integrity, claims, and quality controls." },
  { id: "visualization", label: "Visualization", definition: "Develop and approve visual presentation of data and research outputs." },
  { id: "writing_review_editing", label: "Writing — review and editing", definition: "Take responsibility for reviewing, revising, and approving published text." },
  { id: "project_administration", label: "Project administration", definition: "Coordinate scope, priorities, records, and release work." },
  { id: "resources", label: "Resources", definition: "Provide project infrastructure, subscriptions, and direct project support." },
] as const);

export const AUTHORSHIP_RECORD = Object.freeze({
  schemaVersion: AUTHORSHIP_VERSION,
  effectiveOn: "2026-07-11",
  responsibleAuthor: Object.freeze({
    givenNames: "Fernando",
    familyNames: "Balino",
    displayName: "Fernando Balino",
    affiliation: "Independent project; no institutional affiliation claimed",
    independentStatus: true,
    orcid: null,
    orcidStatus: "not_provided_and_no_reliable_public_match_located_2026-07-11",
    contact: "https://civicaatlas.org/contact",
    roles: Object.freeze(CONTRIBUTOR_ROLE_TAXONOMY.map(({ id }) => id)),
    accountability:
      "Responsible human author and publisher: approves release claims and accepts responsibility for the integrity, correction, and retraction of Civica-authored work.",
  }),
  organizationalPublisher: Object.freeze({
    name: "Civica Atlas",
    url: "https://civicaatlas.org",
    justification:
      "Civica Atlas is retained as the project and publisher name for discovery and continuity. It never replaces the named responsible human in citation or release authorship metadata.",
  }),
  authorshipRules: Object.freeze([
    "Every Civica-authored release and canonical citation names at least one accountable human author.",
    "Organization-only authorship is prohibited unless a versioned exception explains why no individual can be named and identifies a public accountability contact; no such exception currently exists.",
    "Software agents, language models, and tools are disclosed as assistance where material but are never authors or peer reviewers.",
    "Source publishers and external reviewers are credited for their own work and roles; they are not made Civica authors without their explicit consent and an authorship-level contribution.",
    "A byline records responsibility for the published work. Detailed drafting and tool assistance belong in contribution and AI-use disclosures.",
  ]),
  contributionHistory: Object.freeze([
    {
      period: "2026-04-13",
      contribution: "Initiated the repository and directed the first Atlas, source-pipeline, country-page, navigation, and reconciliation foundation.",
      evidence: "Git history beginning at commit 0359b07; named commits by Fernando Balino.",
    },
    {
      period: "2026-04-14/2026-06-30",
      contribution: "Directed and accepted the comparative-reference product, data integrations, methodology surfaces, Index and Pulse experiments, editorial content, and visual system as the sole project owner.",
      evidence: "Repository history and dated project plans; detailed artifact-level history remains in Git.",
    },
    {
      period: "2026-07-01/present",
      contribution: "Directed the academic-readiness program, including provenance, reproducibility, rights, release, Index disposition, Pulse validation preparation, governance, and external-review planning.",
      evidence: "plan/MASTER-CHECKLIST.md, plan/DECISIONS.md, plan/PROGRESS.md, and linked task evidence.",
    },
  ]),
  contributorHistoryRule:
    "Add a named contributor only with consent, exact role ids, contribution period, artifact evidence, affiliation/independent status, contact route, and ORCID when the person supplies one. Preserve prior records when roles change.",
});

export function authorshipHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function authorshipErrors(record: typeof AUTHORSHIP_RECORD = AUTHORSHIP_RECORD): string[] {
  const errors: string[] = [];
  if (record.schemaVersion !== AUTHORSHIP_VERSION) errors.push("wrong schema version");
  const validRoles = new Set(CONTRIBUTOR_ROLE_TAXONOMY.map(({ id }) => id));
  if (!record.responsibleAuthor.displayName || !record.responsibleAuthor.contact || !record.responsibleAuthor.affiliation)
    errors.push("responsible-author identity is incomplete");
  if (record.responsibleAuthor.roles.some((role) => !validRoles.has(role)))
    errors.push("unknown contributor role");
  const orcid = record.responsibleAuthor.orcid as string | null;
  if (orcid !== null && !/^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid))
    errors.push("invalid ORCID");
  if (record.contributionHistory.length < 3 || record.contributionHistory.some((row) => !row.evidence))
    errors.push("contribution history is incomplete");
  if (!record.organizationalPublisher.justification.includes("never replaces"))
    errors.push("organization authorship boundary is absent");
  return errors;
}
