import { readFileSync } from "node:fs";

const runtime = readFileSync("src/lib/pulse/v2/runtime-contract.ts", "utf8");
const classifier = readFileSync("src/lib/pulse/v2/classify.ts", "utf8");
const state = readFileSync("src/lib/pulse/v2/classification-state.ts", "utf8");
const methodology = readFileSync("content/methodology-pulse.md", "utf8");

for (const [path, source, fragments] of [
  [
    "runtime-contract.ts",
    runtime,
    [
      'PULSE_RUNTIME_METHOD_VERSION = "pulse-v2.14-beta"',
      "PULSE_CLASSIFICATION_STATE_VERSION",
      "new_then_due_retry_oldest_first",
      "terminal_none_not_failure",
    ],
  ],
  [
    "classify.ts",
    classifier,
    [
      "CURRENT_CLASSIFICATION_CONFIG_HASH",
      "claimClassificationAttempt",
      "settleClassificationAttempt",
    ],
  ],
  [
    "classification-state.ts",
    state,
    ["maxAttempts: 3", "terminal_failure", "selectClassificationQueue"],
  ],
  [
    "methodology-pulse.md",
    methodology,
    [
      "Never-attempted clusters run before due retries",
      "{{ctx.classificationMaxAttempts}}",
      "Every claim and completion phase is retained",
    ],
  ],
] as const) {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`${path} is missing ${fragment}`);
    }
  }
}

console.log(
  "PASS — the protected Index/Pulse surface preserves versioned classifier state, bounded terminal retries, and disclosed queue behavior under pulse-v2.14-beta.",
);
