import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { GOVERNANCE_EVIDENCE_REVIEW_PACKET } from "./governance-evidence-review-packet";

export const GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR =
  "data/releases/governance-evidence-review-packet-2026-07-v4";

type InventoryRole =
  | "packet-document"
  | "selected-product-input"
  | "selected-product-code"
  | "tournament-package"
  | "tournament-artifact"
  | "disposition"
  | "governance"
  | "rights"
  | "environment";

export type ReviewPacketInventoryRow = {
  artifactId: string;
  role: InventoryRole;
  bytes: number;
  sha256: string;
  path: string;
};

const TOURNAMENT_MANIFEST_PATH =
  "data/releases/index-tournament-results-package-v1/manifest.v1.json";

const CORE_EXTERNAL_ARTIFACTS: ReadonlyArray<{
  artifactId: string;
  role: InventoryRole;
  path: string;
}> = [
  { artifactId: "selected-input-manifest", role: "selected-product-input", path: "data/releases/ci-k1-uncertainty-inputs-2024-v2/manifest.v1.json" },
  { artifactId: "series-provenance-audit", role: "selected-product-input", path: "data/releases/ci-series-provenance-audit-2026-07-v1/manifest.v1.json" },
  { artifactId: "tournament-package-manifest", role: "tournament-package", path: TOURNAMENT_MANIFEST_PATH },
  { artifactId: "tournament-package-inventory", role: "tournament-package", path: "data/releases/index-tournament-results-package-v1/artifact-inventory.v1.csv" },
  { artifactId: "tournament-failure-ledger", role: "tournament-package", path: "data/releases/index-tournament-results-package-v1/error-ledger.v1.json" },
  { artifactId: "confirmatory-decision", role: "disposition", path: "data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json" },
  { artifactId: "adopted-disposition", role: "disposition", path: "data/releases/index-disposition-2026-07-v1/resolution.v1.json" },
  { artifactId: "public-surface-migration", role: "disposition", path: "plan/evidence/IDX-027/README.md" },
  { artifactId: "project-disclosure", role: "governance", path: "data/research/project-disclosure-v1.json" },
  { artifactId: "rights-manifest-code", role: "rights", path: "src/lib/rights/manifest.ts" },
  { artifactId: "package-lock", role: "environment", path: "package-lock.json" },
  { artifactId: "review-packet-contract", role: "selected-product-code", path: "src/lib/ci/governance-evidence-review-packet.ts" },
  { artifactId: "review-packet-builder", role: "selected-product-code", path: "src/lib/ci/governance-evidence-review-package.ts" },
  { artifactId: "review-packet-generator", role: "selected-product-code", path: "scripts/generate-governance-evidence-review-packet.ts" },
  { artifactId: "review-packet-validator", role: "selected-product-code", path: "scripts/validate-governance-evidence-review-packet.ts" },
  ...GOVERNANCE_EVIDENCE_REVIEW_PACKET.implementation.code.map((path, index) => ({
    artifactId: `selected-product-code-${index + 1}`,
    role: "selected-product-code" as const,
    path,
  })),
];

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function csvCell(value: unknown): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function renderReviewPacketReadme(): string {
  const packet = GOVERNANCE_EVIDENCE_REVIEW_PACKET;
  return `# Governance Evidence external-review packet v4

This is the versioned replication and review bundle for Civica's selected source-native public comparison product. It also carries the complete Index tournament inventory, decision, failures, misuse audit, and adopted disposition so a reviewer can assess the choice in context.

The dashboard keeps five established publisher indicators on native scales. The displayed 2024 observations are a harmonized backcast calculated in 2026. It does not emit a Civica composite, grade, rank, country-quality verdict, or claim of independent corroboration. The packet is ready for review; it is not an endorsement and does not imply that independent review has occurred.

## Exact workflow

\`\`\`sh
${packet.reproduction.command}
${packet.reproduction.validationCommand}
\`\`\`

See \`review-questionnaire.md\` for the bounded asks, \`codebook.v1.csv\` for the selected product's five rows, \`artifact-inventory.v1.csv\` for every bound artifact, and \`reproduction.md\` for expected results and rights limits.
`;
}

export function renderReviewQuestions(): string {
  const packet = GOVERNANCE_EVIDENCE_REVIEW_PACKET;
  return `# External-review questionnaire

Status: ${packet.status}. A favorable conclusion is not required, and receipt of this packet does not imply endorsement.

Please identify relevant conflicts before reviewing. For each answer, cite the packet artifact or public surface you relied on and assign one severity: blocking, major, minor, or no concern.

${packet.reviewQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Requested output: ${packet.reviewerTerms.requestedOutput}.
`;
}

export function renderReproductionGuide(): string {
  const packet = GOVERNANCE_EVIDENCE_REVIEW_PACKET;
  return `# Reproduction and verification

Run from the repository root with the Node/npm versions recorded in \`manifest.v1.json\`:

\`\`\`sh
${packet.reproduction.command}
${packet.reproduction.validationCommand}
\`\`\`

Expected result: ${packet.reproduction.expected}

The workflow validates the rights-safe 970-cell dashboard fixture and every referenced tournament artifact. It does not download or republish restricted publisher values. Exact observations remain at \`${packet.frozenInputs.valuesLocation}\` or at the publisher URLs named in the selected-input manifest. Citation is not a reuse grant.
`;
}

export function renderCodebookCsv(): string {
  const header = ["identity", "source_id", "indicator_id", "label", "construct", "direction", "source_url"];
  const rows = GOVERNANCE_EVIDENCE_REVIEW_PACKET.codebook.map((row) => [
    row.identity, row.sourceId, row.indicatorId, row.label, row.construct,
    row.direction, row.sourceUrl,
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function renderCitationCff(): string {
  const citation = GOVERNANCE_EVIDENCE_REVIEW_PACKET.citation;
  return `cff-version: 1.2.0
message: "Cite this review packet and preserve all upstream source attributions."
title: "${citation.title}"
version: "${citation.version}"
type: dataset
authors:
  - given-names: "Fernando"
    family-names: "Balino"
    affiliation: "Independent project; no institutional affiliation claimed"
    website: "https://civicaatlas.org/contact"
publisher: "Civica Atlas"
url: "${citation.url}"
repository-code: "https://github.com/fbalino/civica"
abstract: "A replication and bounded external-review packet for a source-native governance evidence dashboard, including the no-winner Index tournament and adopted disposition."
`;
}

export function renderCommandMapJson(): string {
  return `${JSON.stringify(GOVERNANCE_EVIDENCE_REVIEW_PACKET.implementation.commandMap, null, 2)}\n`;
}

function generatedDocuments(): Array<{ artifactId: string; path: string; content: string }> {
  return [
    { artifactId: "packet-readme", path: `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/README.md`, content: renderReviewPacketReadme() },
    { artifactId: "review-questionnaire", path: `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/review-questionnaire.md`, content: renderReviewQuestions() },
    { artifactId: "reproduction-guide", path: `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/reproduction.md`, content: renderReproductionGuide() },
    { artifactId: "selected-product-codebook", path: `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/codebook.v1.csv`, content: renderCodebookCsv() },
    { artifactId: "packet-citation", path: `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/CITATION.cff`, content: renderCitationCff() },
    { artifactId: "frozen-command-map", path: `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/command-map.v1.json`, content: renderCommandMapJson() },
  ];
}

function inventoryRow(artifactId: string, role: InventoryRole, path: string, content?: string): ReviewPacketInventoryRow {
  const bytes = content === undefined ? readFileSync(path) : Buffer.from(content);
  return { artifactId, role, bytes: bytes.byteLength, sha256: sha256(bytes), path };
}

export function buildGovernanceEvidenceReviewBundle() {
  const tournament = JSON.parse(readFileSync(TOURNAMENT_MANIFEST_PATH, "utf8")) as {
    releaseId: string;
    environment: Record<string, unknown>;
    artifacts: Array<{ id: string; path: string; sha256: string; bytes: number }>;
    winnerSelected: boolean;
  };
  const docs = generatedDocuments();
  const byPath = new Map<string, ReviewPacketInventoryRow>();
  for (const artifact of CORE_EXTERNAL_ARTIFACTS) {
    byPath.set(artifact.path, inventoryRow(artifact.artifactId, artifact.role, artifact.path));
  }
  for (const artifact of tournament.artifacts) {
    const row = inventoryRow(`tournament-${artifact.id}`, "tournament-artifact", artifact.path);
    if (row.sha256 !== artifact.sha256 || row.bytes !== artifact.bytes) {
      throw new Error(`Tournament artifact drift: ${artifact.id}`);
    }
    if (!byPath.has(row.path)) byPath.set(row.path, row);
  }
  for (const doc of docs) {
    byPath.set(doc.path, inventoryRow(doc.artifactId, "packet-document", doc.path, doc.content));
  }
  const inventory = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const base = {
    ...GOVERNANCE_EVIDENCE_REVIEW_PACKET,
    environment: tournament.environment,
    tournamentReleaseId: tournament.releaseId,
    tournamentWinnerSelected: tournament.winnerSelected,
    inventory,
  };
  const bundleSemanticSha256 = sha256(JSON.stringify(canonicalize(base)));
  const manifest = { ...base, bundleSemanticSha256 };
  const inventoryCsv = `${[
    ["artifact_id", "role", "bytes", "sha256", "path"],
    ...inventory.map((row) => [row.artifactId, row.role, row.bytes, row.sha256, row.path]),
  ].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
  const checksums = `${inventory.map((row) => `${row.sha256}  ${row.path}`).join("\n")}\n`;
  return { docs, manifest, inventoryCsv, checksums };
}

export function reviewBundleSemanticSha256(manifest: Record<string, unknown>): string {
  const { bundleSemanticSha256: _ignored, ...base } = manifest;
  return sha256(JSON.stringify(canonicalize(base)));
}
