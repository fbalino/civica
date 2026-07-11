import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { INDEX_TOURNAMENT_PREREGISTRATION, INDEX_TOURNAMENT_PROTOCOL_VERSION, tournamentPreregistrationErrors } from "../src/lib/ci/tournament-preregistration";

const errors = tournamentPreregistrationErrors();
const panelManifest = JSON.parse(readFileSync("data/releases/ci-research-panel-2000-2024-v2/manifest.v2.json", "utf8")) as Record<string, unknown>;
for (const field of ["rowSha256", "coverageSha256", "temporalBreaksSha256"] as const) {
  if (panelManifest[field] !== INDEX_TOURNAMENT_PREREGISTRATION.frozenPanel[field]) errors.push(`panel ${field} drifted from preregistration`);
}
for (const commit of Object.entries(INDEX_TOURNAMENT_PREREGISTRATION.frozenCode).filter(([key]) => key.endsWith("Commit")).map(([, value]) => value)) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" });
  } catch {
    errors.push(`frozen commit is unavailable: ${commit}`);
  }
}
if (errors.length) {
  console.error(errors.map((error) => `FAIL — ${error}`).join("\n"));
  process.exit(1);
}
console.log(`PASS — ${INDEX_TOURNAMENT_PROTOCOL_VERSION} locks ${INDEX_TOURNAMENT_PREREGISTRATION.candidates.length} candidates, ${INDEX_TOURNAMENT_PREREGISTRATION.baselines.length} baselines, six gates, panel hashes, splits, thresholds, and a no-winner rule.`);
