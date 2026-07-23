import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  buildRenderedModuleLedger,
  type RouteRenderSource,
} from "../src/lib/qa/rendered-module-ledger";
import { discoverProductionRoutes } from "./verification-matrix-source";

export function buildLedgerFromTrackedSources() {
  const sourcePaths = execFileSync("git", ["ls-files", "--", "src/app", "src/components"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((sourcePath) => sourcePath.endsWith(".tsx"));
  const sourceByPath = new Map(
    sourcePaths.map((sourcePath) => [sourcePath, readFileSync(sourcePath, "utf8")]),
  );
  const routes: RouteRenderSource[] = discoverProductionRoutes().flatMap((route) => {
    if (route.kind === "handler") return [];
    return [{
      route: route.route,
      sourcePath: route.sourcePath,
      kind: route.kind,
    }];
  });
  return buildRenderedModuleLedger(routes, sourceByPath);
}
