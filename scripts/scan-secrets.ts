/**
 * PLT-007 — secret and sensitive-artifact scanner.
 *
 * Default mode scans the tracked working tree (`git ls-files`, which already
 * excludes gitignored `node_modules`, `.next`, and `.env*`) — this is the gate
 * that keeps a secret from ever being committed, and it covers logs/evidence,
 * `.orchestrator`, plan artifacts, and source snapshots because those are all
 * tracked. `--history` additionally scans the full commit history. `--staged`
 * scans only staged changes (pre-commit use).
 *
 * Findings are always redacted — the scanner never prints a full secret value.
 * A narrow, documented allowlist (`scripts/secret-scan-allowlist.json`) covers
 * known documentation placeholders and fixtures.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  findSecrets,
  isSensitiveFile,
  type SecretFinding,
} from "./secret-patterns";

type Allowlist = {
  // path (or glob-free suffix) -> pattern ids allowed there, with a reason
  files: Array<{ path: string; patternIds: string[]; reason: string }>;
  // sensitive-file paths that are intentionally present (none expected)
  sensitiveFiles: Array<{ path: string; reason: string }>;
  // known, already-tracked historical exposures (queued for rotation), by hash
  knownHistoryExposed?: Array<{
    sha256: string;
    hostHint?: string;
    status: string;
  }>;
  // Exact hashes of non-secret values that older commits used to exercise
  // redaction/configuration tests. These suppress only those historical bytes;
  // they cannot mask a new value and are never applied to the working tree.
  knownHistoryFixtures?: Array<{
    sha256: string;
    patternId: string;
    sourcePaths: string[];
    reason: string;
  }>;
};

const allowlistPath = resolve("scripts/secret-scan-allowlist.json");
const allowlist: Allowlist = existsSync(allowlistPath)
  ? (JSON.parse(readFileSync(allowlistPath, "utf8")) as Allowlist)
  : { files: [], sensitiveFiles: [] };

function allowedPatternsFor(path: string): Set<string> {
  const ids = new Set<string>();
  for (const entry of allowlist.files) {
    if (path === entry.path || path.endsWith(entry.path)) {
      for (const id of entry.patternIds) ids.add(id);
    }
  }
  return ids;
}

function sensitiveAllowed(path: string): boolean {
  return allowlist.sensitiveFiles.some(
    (entry) => path === entry.path || path.endsWith(entry.path),
  );
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean);
}

function isProbablyText(path: string): boolean {
  // Skip obvious binaries by extension; everything else is read as utf8.
  return !/\.(webp|png|jpe?g|gif|ico|pdf|zip|gz|zst|woff2?|ttf|otf|mp4|mov|pmtiles)$/i.test(
    path,
  );
}

type Report = { file: string; findings: SecretFinding[] }[];

function scanTree(): { report: Report; sensitive: string[] } {
  const report: Report = [];
  const sensitive: string[] = [];
  for (const file of trackedFiles()) {
    if (isSensitiveFile(file) && !sensitiveAllowed(file)) sensitive.push(file);
    if (!isProbablyText(file)) continue;
    let size = 0;
    try {
      size = statSync(file).size;
    } catch {
      continue;
    }
    if (size > 4 * 1024 * 1024) continue; // skip very large generated data files
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const findings = findSecrets(text, allowedPatternsFor(file));
    if (findings.length > 0) report.push({ file, findings });
  }
  return { report, sensitive };
}

function scanHistory(): Report {
  // Scan every blob ever committed via `git log -p`. Redacted findings only.
  const diff = execFileSync(
    "git",
    ["log", "-p", "--no-color", "--all", "-U0"],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );
  const known = new Set(
    [
      ...(allowlist.knownHistoryExposed ?? []),
      ...(allowlist.knownHistoryFixtures ?? []),
    ].map((entry) => entry.sha256),
  );
  const findings = findSecrets(diff, new Set(), known);
  return findings.length > 0 ? [{ file: "<git history>", findings }] : [];
}

const mode = process.argv.includes("--history")
  ? "history"
  : process.argv.includes("--staged")
    ? "staged"
    : "tree";

let failures = 0;
if (mode === "history") {
  for (const entry of allowlist.knownHistoryExposed ?? []) {
    console.log(
      `NOTICE: known historical exposure (${entry.hostHint ?? entry.sha256.slice(0, 8)}) — ${entry.status}`,
    );
  }
  const fixtureCount = allowlist.knownHistoryFixtures?.length ?? 0;
  if (fixtureCount > 0) {
    console.log(
      `NOTICE: ${fixtureCount} exact historical non-secret fixture hash(es) are documented separately from real exposures.`,
    );
  }
  const report = scanHistory();
  for (const entry of report) {
    for (const f of entry.findings) {
      console.error(`ERROR: ${entry.file}: ${f.description} [${f.patternId}] ${f.preview}`);
      failures += 1;
    }
  }
  console.log(
    failures === 0
      ? "PASS — no NEW secrets in git history (known exposures are tracked for rotation)."
      : `FAIL — ${failures} unrecognized secret finding(s) in git history.`,
  );
} else {
  const { report, sensitive } = scanTree();
  for (const entry of report) {
    for (const f of entry.findings) {
      console.error(`ERROR: ${entry.file}: ${f.description} [${f.patternId}] ${f.preview}`);
      failures += 1;
    }
  }
  for (const file of sensitive) {
    console.error(`ERROR: ${file}: sensitive artifact tracked in the repository`);
    failures += 1;
  }
  console.log(
    failures === 0
      ? `PASS — no secrets or sensitive artifacts in ${trackedFiles().length} tracked files.`
      : `FAIL — ${failures} secret/sensitive-artifact finding(s).`,
  );
}

process.exit(failures === 0 ? 0 : 1);
