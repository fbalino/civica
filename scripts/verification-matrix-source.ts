import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  ProductionRouteSource,
  VerificationMatrixInputs,
} from "../src/lib/qa/verification-matrix";

const APP_ROOT = "src/app";

function publicPath(sourcePath: string) {
  const relative = sourcePath
    .replace(/^src\/app\/?/, "")
    .split(path.sep)
    .filter((segment) => !/^\(.+\)$/.test(segment));
  const filename = relative.pop()!;
  if (filename === "route.ts" || filename === "page.tsx") {
    return `/${relative.join("/")}`.replace(/\/$/, "") || "/";
  }
  return relative.length ? `/${relative.join("/")}` : "/";
}

export function discoverProductionRoutes(): ProductionRouteSource[] {
  // A release and CI build comprise tracked/indexed files. Restricting this
  // discovery to Git's source set keeps another in-progress, untracked feature
  // from being represented as a shipped production route; newly staged routes
  // are still discovered before their commit.
  const tracked = execFileSync("git", ["ls-files", "--", APP_ROOT], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  return tracked
    .filter((file) => /\/(?:page\.tsx|route\.ts|error\.tsx|global-error\.tsx|not-found\.tsx)$/.test(file))
    .map((file) => {
      const sourcePath = file.split(path.sep).join("/");
      const filename = path.basename(sourcePath);
      return {
        sourcePath,
        route: publicPath(sourcePath),
        kind: filename === "route.ts"
          ? "handler"
          : filename === "page.tsx"
            ? "page"
            : "error_boundary",
      } as ProductionRouteSource;
    })
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

export function checklistTaskIds() {
  const source = readFileSync("plan/MASTER-CHECKLIST.md", "utf8");
  return [...source.matchAll(/\*\*([A-Z]+-\d{3})\*\*/g)].map((match) => match[1]);
}

export function verificationMatrixInputs(): VerificationMatrixInputs {
  return {
    productionRoutes: discoverProductionRoutes(),
    checklistTaskIds: checklistTaskIds(),
  };
}
