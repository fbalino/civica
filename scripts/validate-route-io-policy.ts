/**
 * PLT-012 — deterministic, DB-free route I/O and content-boundary gate.
 *
 * Verifies exact policy coverage for all route-method tuples, validates the
 * closed contract metadata, and statically rejects the unsafe source patterns
 * that previously allowed unbounded parsing, future-column response leaks,
 * and raw exception disclosure.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { ROUTE_INVENTORY } from "../src/lib/api/route-inventory/registry";
import {
  handlerReturnsApprovedErrorBoundary,
  inspectHandlerErrorProfiles,
  policyDefinitionErrors,
  scanRouteSourceSafety,
  validatePolicyCoverage,
} from "../src/lib/api/route-io-policy/checks";
import {
  OPERATIONAL_ERROR_BOUNDARY_ROUTES,
  P1_ERROR_PROFILE_ROUTES,
  ROUTE_IO_POLICY,
  ROUTE_IO_POLICY_VERSION,
} from "../src/lib/api/route-io-policy/registry";

const ROOT = process.cwd();

const EXPECTED_HTML_SINKS = new Map<string, readonly string[]>([
  [
    "src/components/constitution/ConstitutionCrossReferencePane.tsx",
    ["Sanitized", "constitution-html/v1"],
  ],
  [
    "src/components/constitution/ConstitutionReadingColumn.tsx",
    ["Sanitized", "constitution-html/v1"],
  ],
  ["src/components/CivicaLogo.tsx", ["symbol"]],
  ["src/lib/seo/json-ld.tsx", ["serialize(node)"]],
]);

async function walkSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkSourceFiles(absolute)));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(
      [
        "validate-route-io-policy — PLT-012 closed route I/O gate",
        "",
        "Usage:",
        "  npm run validate:route-io-policy",
      ].join("\n"),
    );
    return;
  }

  const errors: string[] = [];
  const coverage = validatePolicyCoverage(ROUTE_INVENTORY, ROUTE_IO_POLICY);
  for (const key of coverage.missing)
    errors.push(`missing policy tuple: ${key}`);
  for (const key of coverage.stale) errors.push(`stale policy tuple: ${key}`);
  for (const key of coverage.duplicates) {
    errors.push(`duplicate policy tuple: ${key}`);
  }
  errors.push(...policyDefinitionErrors(ROUTE_IO_POLICY));

  for (const entry of ROUTE_INVENTORY) {
    const routePath = path.join(ROOT, "src/app", entry.filePath);
    const source = await fs.readFile(routePath, "utf8");
    for (const finding of scanRouteSourceSafety(source, routePath)) {
      errors.push(
        `${path.relative(ROOT, routePath)}:${finding.line} [${finding.kind}] ${finding.detail}`,
      );
    }
  }

  for (const target of OPERATIONAL_ERROR_BOUNDARY_ROUTES) {
    const routePath = path.join(ROOT, "src/app", target.filePath);
    const source = await fs.readFile(routePath, "utf8");
    if (
      !handlerReturnsApprovedErrorBoundary(source, target.method, routePath)
    ) {
      errors.push(
        `${path.relative(ROOT, routePath)}#${target.method}: handler does not return the approved fixed-error boundary`,
      );
    }
  }

  for (const target of P1_ERROR_PROFILE_ROUTES) {
    const routePath = path.join(ROOT, "src/app", target.filePath);
    const source = await fs.readFile(routePath, "utf8");
    const report = inspectHandlerErrorProfiles(
      source,
      target.method,
      routePath,
    );
    if (!report.handlerFound) {
      errors.push(
        `${path.relative(ROOT, routePath)}#${target.method}: registered P1 handler is missing`,
      );
    }
    if (report.sites === 0) {
      errors.push(
        `${path.relative(ROOT, routePath)}#${target.method}: no actual error response calls were found`,
      );
    }
    for (const finding of report.findings) {
      errors.push(
        `${path.relative(ROOT, routePath)}:${finding.line} [${finding.kind}] ${finding.detail}`,
      );
    }
  }

  // Inspect every directly declared route handler, not only the P1 repair
  // sample. Cron aliases retain their specialized cron safety gate, while any
  // explicit JSON problem in an inspectable handler must carry a stable code,
  // an error status, and a literal non-cacheable transport policy.
  for (const target of ROUTE_IO_POLICY) {
    const routePath = path.join(ROOT, "src/app", target.filePath);
    const source = await fs.readFile(routePath, "utf8");
    const report = inspectHandlerErrorProfiles(
      source,
      target.method,
      routePath,
    );
    if (!report.handlerFound && target.exposure !== "cron") {
      errors.push(
        `${path.relative(ROOT, routePath)}#${target.method}: registered handler is missing`,
      );
    }
    for (const finding of report.findings) {
      errors.push(
        `${path.relative(ROOT, routePath)}:${finding.line} [${finding.kind}] ${finding.detail}`,
      );
    }
  }

  const sourceFiles = await walkSourceFiles(path.join(ROOT, "src"));
  const actualHtmlSinks = new Set<string>();
  for (const absolute of sourceFiles) {
    const source = await fs.readFile(absolute, "utf8");
    if (!source.includes("dangerouslySetInnerHTML")) continue;
    const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
    actualHtmlSinks.add(relative);
    const requiredMarkers = EXPECTED_HTML_SINKS.get(relative);
    if (!requiredMarkers) {
      errors.push(`${relative}: unregistered dangerouslySetInnerHTML sink`);
      continue;
    }
    if (!requiredMarkers.some((marker) => source.includes(marker))) {
      errors.push(
        `${relative}: dangerous HTML sink lacks its declared trusted/sanitized boundary marker`,
      );
    }
  }
  for (const expected of EXPECTED_HTML_SINKS.keys()) {
    if (!actualHtmlSinks.has(expected)) {
      errors.push(`${expected}: registered dangerous HTML sink is missing`);
    }
  }

  console.log(`=== Civica ${ROUTE_IO_POLICY_VERSION} validation ===`);
  console.log(
    `✓ ${ROUTE_INVENTORY.length} route files / ${ROUTE_IO_POLICY.length} route-method contracts`,
  );
  console.log(
    `✓ ${new Set(ROUTE_IO_POLICY.map(({ request }) => request.id)).size} request contracts`,
  );
  console.log(
    `✓ ${OPERATIONAL_ERROR_BOUNDARY_ROUTES.length} operational error boundaries`,
  );
  console.log(`✓ ${P1_ERROR_PROFILE_ROUTES.length} P1 error profiles`);
  console.log(
    `✓ ${ROUTE_IO_POLICY.length} route-method error profiles covered (cron aliases use the specialized cron gate)`,
  );
  console.log(`✓ ${actualHtmlSinks.size} registered dangerous HTML sinks`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const error of errors) console.error(`✗ ${error}`);
    process.exit(1);
  }
  console.log("All route I/O policy checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
