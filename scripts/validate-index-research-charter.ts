import { readFileSync } from "node:fs";
import { INDEX_RESEARCH_CHARTER, INDEX_RESEARCH_CHARTER_PATH, researchCharterErrors } from "../src/lib/ci/research-charter";

const errors = researchCharterErrors(readFileSync(INDEX_RESEARCH_CHARTER_PATH, "utf8"));
if (INDEX_RESEARCH_CHARTER.targetUsers.length < 5) errors.push("target-user set is incomplete");
if (INDEX_RESEARCH_CHARTER.allowedUnits.length < 5) errors.push("unit contract is incomplete");
if (INDEX_RESEARCH_CHARTER.noveltyTests.length !== 2) errors.push("novelty requires both information and use tests");
if (!INDEX_RESEARCH_CHARTER.noWinnerAllowed) errors.push("no-winner outcome is not allowed");
if (errors.length) {
  console.error(errors.map((error) => `FAIL — ${error}`).join("\n"));
  process.exit(1);
}
console.log(`PASS — ${INDEX_RESEARCH_CHARTER_PATH} defines users, units, constructs, nonclaims, novelty, misuse, and retirement.`);
