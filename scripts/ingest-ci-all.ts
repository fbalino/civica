import { config } from "dotenv";
config({ path: ".env.local" });

import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

// Orchestrator: runs CI source adapters sequentially and reports summary.
// The WGI democracy fallback fills countries not covered by V-Dem; it must run
// after the primary V-Dem adapter.
// Usage: npm run ingest:ci   (wired in package.json)

const ADAPTERS = [
  { name: "V-Dem (democratic_quality)", script: "ingest-ci-vdem.ts" },
  { name: "World Bank WGI (rule_of_law)", script: "ingest-ci-wgi.ts" },
  {
    name: "World Bank WGI (democratic_quality fallback)",
    script: "ingest-ci-wgi-democracy-fallback.ts",
  },
  { name: "UNDP HDI (human_development)", script: "ingest-ci-hdi.ts" },
  { name: "Freedom House (freedom_rights)", script: "ingest-ci-freedom-house.ts" },
  { name: "Transparency Intl CPI (corruption_control)", script: "ingest-ci-cpi.ts" },
  { name: "Global Peace Index (stability_security)", script: "ingest-ci-gpi.ts" },
];

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

function runAdapter(name: string, script: string): boolean {
  const scriptPath = path.join(SCRIPTS_DIR, script);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Adapter: ${name}`);
  console.log("=".repeat(60));
  try {
    execFileSync("npx", ["tsx", scriptPath], { stdio: "inherit" });
    return true;
  } catch {
    console.error(`\n[FAILED] ${name}`);
    return false;
  }
}

function main() {
  console.log("CI Index — Full ingestion run");
  console.log(`Started: ${new Date().toISOString()}`);

  let passed = 0;
  let failed = 0;

  for (const { name, script } of ADAPTERS) {
    if (runAdapter(name, script)) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Summary: ${passed}/${ADAPTERS.length} adapters succeeded`);
  if (failed > 0) {
    console.error(`${failed} adapter(s) failed — check errors above`);
    process.exit(1);
  }
  console.log(`Finished: ${new Date().toISOString()}`);
}

main();
