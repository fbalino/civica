/**
 * PLT-002 — deterministic, enforceable lint gate.
 *
 * `npm run lint` scans all owned source (the eslint flat config already ignores
 * generated `.next/**` and `.claude/worktrees/**` trees). This gate turns its
 * output into a ratchet: the pre-existing error backlog is frozen in
 * `scripts/lint-baseline.json` keyed by `<file>\t<ruleId>`, so a NEW source
 * violation — a new file/rule pair or a higher count on an existing one — fails
 * the gate, while the known backlog is tracked and can only ratchet DOWN. This
 * mirrors the sanctioned design-token baseline pattern.
 *
 * Declared bound: the underlying `eslint` run completes well within 120s on the
 * full project; this gate adds only JSON aggregation.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Baseline = {
  totalBaselinedErrors: number;
  errors: Record<string, number>;
};

type EslintMessage = { ruleId: string | null; severity: number };
type EslintResult = { filePath: string; messages: EslintMessage[] };

const root = `${process.cwd()}/`;
const baseline = JSON.parse(
  readFileSync(resolve("scripts/lint-baseline.json"), "utf8"),
) as Baseline;

function currentErrorCounts(): Record<string, number> {
  let raw: string;
  try {
    raw = execFileSync("npx", ["eslint", "-f", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // eslint exits non-zero when it reports problems; its JSON is still on stdout.
    const stdout = (error as { stdout?: string }).stdout;
    if (!stdout) throw error;
    raw = stdout;
  }
  const results = JSON.parse(raw) as EslintResult[];
  const counts: Record<string, number> = {};
  for (const result of results) {
    const rel = result.filePath.replace(root, "");
    for (const message of result.messages) {
      if (message.severity !== 2) continue;
      const key = `${rel}\t${message.ruleId ?? "unknown"}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

const counts = currentErrorCounts();
const regressions: string[] = [];
const fixedOpportunities: string[] = [];

for (const [key, count] of Object.entries(counts)) {
  const allowed = baseline.errors[key] ?? 0;
  if (count > allowed) {
    const [file, rule] = key.split("\t");
    regressions.push(
      `NEW lint error(s): ${file} — ${rule} (${count}, baseline allows ${allowed})`,
    );
  }
}
for (const [key, allowed] of Object.entries(baseline.errors)) {
  const count = counts[key] ?? 0;
  if (count < allowed) {
    const [file, rule] = key.split("\t");
    fixedOpportunities.push(
      `RATCHET: ${file} — ${rule} now ${count} (baseline ${allowed}); tighten the baseline`,
    );
  }
}

const currentTotal = Object.values(counts).reduce((a, b) => a + b, 0);

if (regressions.length > 0) {
  for (const line of regressions) console.error(`ERROR: ${line}`);
  console.error(
    `\nFAIL — ${regressions.length} new lint violation(s). Fix them, or (only with cause) update scripts/lint-baseline.json.`,
  );
  process.exit(1);
}

for (const line of fixedOpportunities) console.log(line);
console.log(
  `\nPASS — no new lint errors. ${currentTotal} baselined error(s) remain across ${Object.keys(counts).length} file/rule groups (backlog only ratchets down).`,
);
