/**
 * Validate Civica's machine-readable public-claims registry.
 *
 * The marker convention makes headline claims discoverable without parsing
 * arbitrary prose or JSX: place `PUBLIC_CLAIM: <id>` immediately beside a
 * registered claim, then record its exact source fragment in the registry.
 * Registration inventories current copy; it does not endorse that copy.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PUBLIC_CLAIM_TIERS,
  PUBLIC_CLAIM_TIER_IDS,
} from "../src/lib/claims/claim-tiers";
import {
  PUBLIC_CLAIMS,
  PUBLIC_CLAIM_SURFACES,
  publicClaimMarker,
  type PublicClaim,
} from "../src/lib/claims/public-claims";
import { validatePublicClaimRegistry } from "../src/lib/claims/registry-validation";
import { findUnqualifiedAuthorityLanguage } from "../src/lib/claims/authority-language";

const MARKER_PATTERN = /PUBLIC_CLAIM:\s*([a-z0-9][a-z0-9.-]*)/g;
const MARKER_SCAN_ROOTS = [
  "README.md",
  "README.template.md",
  "CITATION.cff",
  "content",
  "src/app",
  "src/components",
  "src/lib/og.ts",
] as const;
const AUTHORITY_COPY_SCAN_ROOTS = [
  "README.md",
  "README.template.md",
  "CITATION.cff",
  "content",
  "src/app",
  "src/components/home",
  "src/components/ci/CIPulseScoreDisplay.tsx",
  "src/lib/og.ts",
] as const;
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".md", ".cff"]);
const CLAIMS: readonly PublicClaim[] = PUBLIC_CLAIMS;

interface MarkerLocation {
  id: string;
  file: string;
  line: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await fs.stat(path.resolve(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

async function listScannedFiles(relativePath: string): Promise<string[]> {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const stat = await fs.stat(absolutePath);
  if (stat.isFile()) return [relativePath];

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const child = path.posix.join(relativePath, entry.name);
      if (entry.isDirectory()) return listScannedFiles(child);
      return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [child] : [];
    }),
  );
  return files.flat();
}

async function collectMarkers(): Promise<MarkerLocation[]> {
  const files = (
    await Promise.all(MARKER_SCAN_ROOTS.map((root) => listScannedFiles(root)))
  ).flat();
  const markers: MarkerLocation[] = [];

  for (const file of files) {
    const content = await fs.readFile(path.resolve(process.cwd(), file), "utf8");
    let match: RegExpExecArray | null;
    MARKER_PATTERN.lastIndex = 0;
    while ((match = MARKER_PATTERN.exec(content)) !== null) {
      markers.push({ id: match[1], file, line: lineOf(content, match.index) });
    }
  }

  return markers;
}

async function validateAuthorityLanguage(): Promise<string[]> {
  const files = (
    await Promise.all(
      AUTHORITY_COPY_SCAN_ROOTS.map((root) => listScannedFiles(root)),
    )
  ).flat();
  const errors: string[] = [];

  for (const file of files) {
    const content = await fs.readFile(path.resolve(process.cwd(), file), "utf8");
    for (const match of findUnqualifiedAuthorityLanguage(content)) {
      errors.push(
        `unqualified authority language (${match.ruleId}) in ${file}:${lineOf(content, match.index)} — ${JSON.stringify(match.match)}`,
      );
    }
  }

  return errors;
}

async function main(): Promise<void> {
  const structural = validatePublicClaimRegistry(CLAIMS);
  const errors = [...structural.errors];
  const registryIds = new Set(CLAIMS.map((claim) => claim.id));

  for (const claim of CLAIMS) {
    const sourcePaths = [claim.source.path, ...(claim.source.mirrors ?? [])];
    for (const sourcePath of sourcePaths) {
      if (!(await exists(sourcePath))) {
        errors.push(`${claim.id}: missing source or mirror ${sourcePath}`);
        continue;
      }
      const content = await fs.readFile(
        path.resolve(process.cwd(), sourcePath),
        "utf8",
      );
      const marker = publicClaimMarker(claim.id);
      const markerCount = content.split(marker).length - 1;
      if (markerCount !== 1) {
        errors.push(
          `${claim.id}: expected exactly one marker in ${sourcePath}, found ${markerCount}`,
        );
      }
    }

    const sourceContent = await fs.readFile(
      path.resolve(process.cwd(), claim.source.path),
      "utf8",
    );
    if (
      !normalizeWhitespace(sourceContent).includes(
        normalizeWhitespace(claim.source.fragment),
      )
    ) {
      errors.push(
        `${claim.id}: exact source fragment drifted in ${claim.source.path}`,
      );
    }

    for (const evidenceSource of claim.evidenceSources) {
      if (!(await exists(evidenceSource))) {
        errors.push(`${claim.id}: missing evidence source ${evidenceSource}`);
      }
    }
  }

  const markers = await collectMarkers();
  for (const marker of markers) {
    if (!registryIds.has(marker.id)) {
      errors.push(
        `unregistered headline claim marker: ${marker.id} (${marker.file}:${marker.line})`,
      );
    }
  }

  for (const claim of CLAIMS) {
    const expectedFiles = new Set([
      claim.source.path,
      ...(claim.source.mirrors ?? []),
    ]);
    const actualFiles = new Set(
      markers.filter((marker) => marker.id === claim.id).map((marker) => marker.file),
    );
    for (const actualFile of actualFiles) {
      if (!expectedFiles.has(actualFile)) {
        errors.push(`${claim.id}: unexpected marker in ${actualFile}`);
      }
    }
  }

  const authorityErrors = await validateAuthorityLanguage();
  errors.push(...authorityErrors);

  console.log("=== Civica public-claims validation ===\n");
  console.log(
    `Claims: ${CLAIMS.length}; required surfaces: ${structural.coveredSurfaces.length}/${PUBLIC_CLAIM_SURFACES.length}`,
  );
  console.log(
    `Tiers: ${PUBLIC_CLAIM_TIER_IDS.length}; definitions: ${Object.keys(PUBLIC_CLAIM_TIERS).length}`,
  );
  console.log(`Markers inspected: ${markers.length}`);
  console.log(`Unqualified high-authority phrases: ${authorityErrors.length}`);

  if (errors.length > 0) {
    console.error(`\nFAILED — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("Unregistered headline claims: 0");
  console.log("\nPASS — registry, tier mapping, evidence paths, and claim markers agree.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
