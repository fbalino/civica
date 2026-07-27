/**
 * Validate the closed PLT-011 rate-limit policy registry against the
 * canonical PLT-008 route inventory. DB- and network-free.
 *
 * Source markers close durable integrations; a checked live-firewall artifact
 * closes externally enforced mappings without making a network request.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { ROUTE_INVENTORY } from "../src/lib/api/route-inventory/registry";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_POLICY_VERSION,
  RATE_LIMIT_ROUTE_POLICIES,
  findProcessLocalRateLimitMarkers,
  matchesPlatformWafEvidence,
  summarizeRateLimitPolicyImplementations,
  validateRateLimitPolicyRegistry,
  type PlatformWafEvidence,
} from "../src/lib/api/rate-limit-policy";

function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(
      [
        "validate-rate-limit-policy — PLT-011 closed policy validation",
        "",
        "Usage:",
        "  npx tsx scripts/validate-rate-limit-policy.ts",
        "",
        "Cross-checks every canonical route+method against an explicit",
        "durable, platform, authenticated-session, cron, or bounded-read",
        "disposition and validates checked deployed-WAF evidence.",
      ].join("\n"),
    );
    return;
  }

  console.log(
    `=== Civica rate-limit policy validation (${RATE_LIMIT_POLICY_VERSION}) ===\n`,
  );

  const issues = validateRateLimitPolicyRegistry({
    routeInventory: ROUTE_INVENTORY,
    policies: RATE_LIMIT_POLICIES,
    mappings: RATE_LIMIT_ROUTE_POLICIES,
  });
  const canonicalMethodCount = ROUTE_INVENTORY.reduce(
    (total, entry) => total + entry.methods.length,
    0,
  );
  const mappedMethodCount = RATE_LIMIT_ROUTE_POLICIES.reduce(
    (total, mapping) => total + mapping.methods.length,
    0,
  );
  const implementation = summarizeRateLimitPolicyImplementations(
    RATE_LIMIT_ROUTE_POLICIES,
  );
  const integrationMarkerErrors: string[] = [];
  const productionSources: Record<string, string> = {};
  for (const mapping of RATE_LIMIT_ROUTE_POLICIES) {
    const sourcePath = path.join(process.cwd(), "src/app", mapping.filePath);
    if (!(mapping.filePath in productionSources)) {
      try {
        productionSources[mapping.filePath] = readFileSync(sourcePath, "utf8");
      } catch {
        productionSources[mapping.filePath] = "";
      }
    }
    if (
      mapping.disposition.kind !== "durable-db" ||
      mapping.disposition.implementation !== "source-confirmed"
    ) {
      continue;
    }
    const marker = mapping.disposition.integrationMarker;
    if (!marker) continue; // The pure validator reports this configuration error.
    const source = productionSources[mapping.filePath];
    if (!source) {
      integrationMarkerErrors.push(
        `${mapping.filePath}: source-confirmed route source could not be read`,
      );
      continue;
    }
    if (!source.includes(marker)) {
      integrationMarkerErrors.push(
        `${mapping.filePath}: source-confirmed durable marker ${JSON.stringify(marker)} was not found`,
      );
    }
  }
  productionSources["src/lib/api/rate-limit.ts"] = readFileSync(
    path.join(process.cwd(), "src/lib/api/rate-limit.ts"),
    "utf8",
  );
  const processLocalErrors =
    findProcessLocalRateLimitMarkers(productionSources);

  const externalEvidenceErrors: string[] = [];
  const checkedEvidencePaths = new Set<string>();
  for (const policy of RATE_LIMIT_POLICIES) {
    if (
      policy.kind !== "platform-waf" ||
      policy.verification !== "external-verified"
    ) {
      continue;
    }
    const evidencePath = policy.evidencePath;
    if (!evidencePath) {
      externalEvidenceErrors.push(
        `${policy.id}: externally verified policy has no evidence path`,
      );
      continue;
    }
    if (checkedEvidencePaths.has(evidencePath)) continue;
    checkedEvidencePaths.add(evidencePath);

    try {
      const evidence = JSON.parse(
        readFileSync(path.join(process.cwd(), evidencePath), "utf8"),
      ) as PlatformWafEvidence;
      if (!matchesPlatformWafEvidence(policy, evidence)) {
        externalEvidenceErrors.push(
          `${policy.id}: ${evidencePath} does not prove the registered active all-path rule`,
        );
      }
    } catch {
      externalEvidenceErrors.push(
        `${policy.id}: external evidence could not be read or parsed at ${evidencePath}`,
      );
    }
  }

  console.log(`Canonical routes: ${ROUTE_INVENTORY.length}`);
  console.log(`Canonical route-methods: ${canonicalMethodCount}`);
  console.log(`Mapped route-methods: ${mappedMethodCount}`);
  console.log(`Policy definitions: ${RATE_LIMIT_POLICIES.length}`);
  console.log(
    `Implementation status (route-methods): source-confirmed=${implementation["source-confirmed"]}, partial=${implementation.partial}, planned=${implementation.planned}, external-required=${implementation["external-required"]}, external-verified=${implementation["external-verified"]}`,
  );

  if (
    issues.length > 0 ||
    integrationMarkerErrors.length > 0 ||
    processLocalErrors.length > 0 ||
    externalEvidenceErrors.length > 0
  ) {
    console.error(
      `\nFAILED — ${issues.length + integrationMarkerErrors.length + processLocalErrors.length + externalEvidenceErrors.length} policy problem(s):`,
    );
    for (const issue of issues) {
      console.error(
        `- [${issue.code}]${issue.routeMethod ? ` ${issue.routeMethod}:` : ""} ${issue.message}`,
      );
    }
    for (const error of integrationMarkerErrors) {
      console.error(`- [missing-integration-marker] ${error}`);
    }
    for (const error of processLocalErrors) {
      console.error(`- [process-local-rate-limit] ${error}`);
    }
    for (const error of externalEvidenceErrors) {
      console.error(`- [invalid-external-evidence] ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nPASS — every canonical route+method has a valid closed disposition.",
  );
  if (
    implementation.planned > 0 ||
    implementation.partial > 0 ||
    implementation["external-required"] > 0
  ) {
    console.log(
      "STATUS — PLT-011 remains pending until planned/partial integrations and externally verified WAF controls are closed.",
    );
  } else {
    console.log(
      "STATUS — all durable integrations and external platform controls are verified.",
    );
  }
}

main();
