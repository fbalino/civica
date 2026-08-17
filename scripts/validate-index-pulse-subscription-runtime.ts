/**
 * Version-specific validator for `civica-index-pulse-subscription-runtime-v60`
 * (Index change-control): binds the pulse-v2.16-beta subscription runtime's
 * load-bearing guarantees so later edits cannot silently weaken them.
 *
 * DB-free and deterministic. Checks:
 *  1. The generated runtime contract names method pulse-v2.16-beta and the
 *     owner-approved four-voter subscription panel with transport identity.
 *  2. `pulse-validation-protocol/v2` supersedes v1 pre-start and the v1
 *     artifact is preserved with its recorded semantic hash.
 *  3. The scheduled classify route carries the $0 transport lock.
 *  4. classify.ts keeps the PUL-036 strengthening: subscription-transport
 *     classifications can never auto-publish.
 */
import { readFileSync } from "node:fs";

const errors: string[] = [];

function check(ok: boolean, message: string): void {
  if (!ok) errors.push(message);
}

const contractRaw = readFileSync(
  "src/lib/pulse/v2/runtime-method.generated.json",
  "utf8",
);
check(
  contractRaw.includes('"pulse-v2.16-beta"'),
  "runtime contract must name method pulse-v2.16-beta",
);
for (const model of [
  "gpt-5.6-terra",
  "claude-sonnet-5",
  "kimi-k3",
  "grok-4.5",
]) {
  check(
    contractRaw.includes(`"${model}"`),
    `runtime contract must pin subscription voter model ${model}`,
  );
}
check(
  (contractRaw.match(/"subscription-cli"/g) ?? []).length >= 6,
  "runtime contract must mark classify/verify/subject transports as subscription-cli",
);
check(
  !contractRaw.includes("deepseek-v4-flash"),
  "runtime contract must not present a paid HTTP voter as current",
);

const protocolV2 = JSON.parse(
  readFileSync("data/research/pulse-validation-protocol-v2.json", "utf8"),
) as {
  schemaVersion: string;
  supersedes?: { version?: string; windowStartedUnderPrior?: boolean };
  classifierConfiguration?: { transport?: string };
};
check(
  protocolV2.schemaVersion === "pulse-validation-protocol/v2",
  "protocol v2 artifact must carry schema v2",
);
check(
  protocolV2.supersedes?.version === "pulse-validation-protocol/v1" &&
    protocolV2.supersedes?.windowStartedUnderPrior === false,
  "protocol v2 must supersede v1 pre-start",
);
check(
  protocolV2.classifierConfiguration?.transport === "subscription-cli",
  "protocol v2 must freeze the subscription transport",
);

const protocolV1 = JSON.parse(
  readFileSync("data/research/pulse-validation-protocol-v1.json", "utf8"),
) as { schemaVersion: string; semanticSha256: string };
check(
  protocolV1.schemaVersion === "pulse-validation-protocol/v1" &&
    protocolV1.semanticSha256 ===
      "89bea0ceb83090725e9a65a39e7e96a0f8e5badcae988493cd06873267a329e3",
  "preserved v1 protocol artifact drifted",
);

const route = readFileSync(
  "src/app/api/cron/pulse/v2/classify/route.ts",
  "utf8",
);
check(
  route.includes("PULSE_CLASSIFY_TRANSPORT") &&
    route.includes("paid_transport_locked"),
  "scheduled classify route must keep the $0 transport lock",
);

const classify = readFileSync("src/lib/pulse/v2/classify.ts", "utf8");
check(
  (classify.match(/!requiresReview && !subscriptionTransportActive\(\)/g) ?? [])
    .length >= 2,
  "classify.ts must keep the subscription always-queue gate (PUL-036)",
);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(
  "PASS — subscription-runtime v60 contract: v2.16 panel, protocol v2 supersession, route $0 lock, and PUL-036 always-queue are all bound.",
);
