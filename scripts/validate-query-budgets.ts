import { existsSync, readFileSync } from "node:fs";
import {
  QUERY_BUDGETS,
  QUERY_BUDGET_CONTRACT_VERSION,
  queryBudgetContractErrors,
} from "@/lib/platform/query-budget";

const schemaPath = "src/lib/db/schema.ts";
const schemaSource = readFileSync(schemaPath, "utf8");
const errors = queryBudgetContractErrors();

for (const budget of QUERY_BUDGETS) {
  for (const sourceFile of budget.sourceFiles) {
    if (!existsSync(sourceFile))
      errors.push(`${budget.id}: missing source file ${sourceFile}`);
  }
  for (const indexName of budget.requiredIndexes) {
    if (!schemaSource.includes(`\"${indexName}\"`)) {
      errors.push(`${budget.id}: ${indexName} is not declared in ${schemaPath}`);
    }
  }
}

if (errors.length > 0) {
  throw new Error(
    `Query-budget contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.log(
  `${QUERY_BUDGET_CONTRACT_VERSION}: ${QUERY_BUDGETS.length} bounded critical query profiles pass static validation.`,
);
