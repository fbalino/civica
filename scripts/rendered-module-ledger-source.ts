import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  applyRenderedModuleEvidence,
  buildRenderedModuleLedger,
  type RenderedModuleEvidenceRegistry,
  type RouteRenderSource,
} from "../src/lib/qa/rendered-module-ledger";
import { discoverProductionRoutes } from "./verification-matrix-source";

const evidencePath = "data/rendered-module-evidence.v1.json";
const renderedDocumentHandlers = new Set(["src/app/embed/[slug]/route.ts"]);

function renderedRoute(route: {
  route: string;
  sourcePath: string;
  kind: "page" | "handler" | "error_boundary";
}): RouteRenderSource | null {
  if (renderedDocumentHandlers.has(route.sourcePath)) {
    return {
      route: route.route,
      sourcePath: route.sourcePath,
      kind: "document",
    };
  }
  if (route.kind === "handler") return null;
  if (route.kind === "error_boundary") {
    const name = route.sourcePath.endsWith("/not-found.tsx")
      ? "not_found"
      : route.sourcePath.endsWith("/global-error.tsx")
        ? "global_error"
        : "error";
    return {
      route: `/__${name}__`,
      sourcePath: route.sourcePath,
      kind: route.kind,
    };
  }
  return {
    route: route.route,
    sourcePath: route.sourcePath,
    kind: route.kind,
  };
}

export function buildLedgerFromTrackedSources() {
  const trackedPaths = execFileSync("git", ["ls-files", "--", "src/app", "src/components"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const sourcePaths = trackedPaths.filter(
    (sourcePath) =>
      sourcePath.endsWith(".tsx") || renderedDocumentHandlers.has(sourcePath),
  );
  const sourceByPath = new Map(
    sourcePaths.map((sourcePath) => [
      sourcePath,
      execFileSync("git", ["show", `:${sourcePath}`], { encoding: "utf8" }),
    ]),
  );
  const routes: RouteRenderSource[] = discoverProductionRoutes().flatMap(
    (route) => {
      const rendered = renderedRoute(route);
      return rendered ? [rendered] : [];
    },
  );
  const ledger = buildRenderedModuleLedger(routes, sourceByPath);
  const evidence = JSON.parse(
    readFileSync(evidencePath, "utf8"),
  ) as RenderedModuleEvidenceRegistry;
  return applyRenderedModuleEvidence(ledger, evidence);
}
