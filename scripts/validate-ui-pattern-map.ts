/**
 * EXP-002 — CLI gate for the UI pattern → canonical-binding map.
 * Fails closed when the map references a token/primitive/class that does not
 * exist, drops a required pattern family, or leaves an exception/unmatched
 * pattern without a follow-up task.
 */
import {
  UI_PATTERN_MAP,
  REQUIRED_FAMILIES,
  validateUiPatternMap,
  unmatchedPatterns,
} from "../src/lib/design/ui-pattern-map";

const errors = validateUiPatternMap();
const families = UI_PATTERN_MAP.length;
const patterns = UI_PATTERN_MAP.reduce((n, f) => n + f.patterns.length, 0);

console.log(
  `UI pattern map: ${families}/${REQUIRED_FAMILIES.length} families, ${patterns} patterns.`,
);
const unmatched = unmatchedPatterns();
console.log(`Unmatched patterns needing canonicalization: ${unmatched.length}`);
for (const u of unmatched) {
  console.log(`  - ${u.family} › ${u.pattern} → ${u.followUpTaskId}`);
}

// Approved exceptions each point at the task that owns their eventual cleanup —
// the "unmatched/legacy patterns become explicit design-system tasks" linkage.
const exceptions = UI_PATTERN_MAP.flatMap((f) =>
  f.patterns
    .filter((p) => p.kind === "approved-exception")
    .map((p) => `${f.family} › ${p.pattern} → ${p.followUpTaskId}`),
);
console.log(`Approved exceptions (owned by a follow-up task): ${exceptions.length}`);
for (const e of exceptions) console.log(`  - ${e}`);

if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`\nFAIL — UI pattern map has ${errors.length} error(s).`);
  process.exit(1);
}
console.log("OK — every canonical binding exists and all families are covered.");
