/**
 * Vercel build entry point (`vercel.json` buildCommand -> `npm run vercel-build`).
 *
 * Production (and anything that is not a pull-request preview) runs the full
 * `npm run build`, exactly as before. A pull-request preview build skips the offline
 * validator chain, which GitHub Actions `verify` already runs on every pull
 * request through `npm run build:ci`, and runs only what needs this
 * environment: the Vercel environment contract, the validators that read the
 * live database, and `next build` itself.
 *
 * Put `[full-build]` in the head commit message to force the complete chain on
 * a preview. The canonical description is the "Build and deploy pipeline"
 * section of AGENTS.md.
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const FULL_BUILD_TOKEN = "[full-build]";

/**
 * Preview-only steps. Each one either needs Vercel's environment (a database
 * connection or the real env contract) or behaves differently when
 * DATABASE_URL is set, so the credential-free `verify` run cannot cover it.
 * Every other step in `build:core` and `prebuild` passes identically without
 * a database and is covered by `verify`.
 */
export const PREVIEW_STEPS: readonly (readonly string[])[] = [
  ["npm", "run", "validate:env", "--", "--context=build"],
  ["npm", "run", "validate:jurisdiction-directory"],
  ["npm", "run", "validate:content-templates"],
  ["npm", "exec", "--", "next", "build"],
];

export const FULL_STEPS: readonly (readonly string[])[] = [
  ["npm", "run", "build"],
];

export function planBuild(
  env: Record<string, string | undefined>,
): { mode: "full" | "preview"; reason: string; steps: readonly (readonly string[])[] } {
  if (env.VERCEL_ENV !== "preview") {
    return {
      mode: "full",
      reason: `VERCEL_ENV=${env.VERCEL_ENV ?? "(unset)"} is not a preview`,
      steps: FULL_STEPS,
    };
  }
  // GitHub `verify` runs on pull requests (and on main), not on bare branch
  // pushes. A preview with no pull-request ID (branch pushed before the PR
  // exists, or a CLI deployment) has no verify run behind it, so it keeps the
  // complete chain.
  if (!(env.VERCEL_GIT_PULL_REQUEST_ID ?? "").trim()) {
    return {
      mode: "full",
      reason: "preview is not tied to a pull request, so verify has not covered it",
      steps: FULL_STEPS,
    };
  }
  if ((env.VERCEL_GIT_COMMIT_MESSAGE ?? "").includes(FULL_BUILD_TOKEN)) {
    return {
      mode: "full",
      reason: `commit message contains ${FULL_BUILD_TOKEN}`,
      steps: FULL_STEPS,
    };
  }
  return {
    mode: "preview",
    reason: "preview build; offline validators run in GitHub verify",
    steps: PREVIEW_STEPS,
  };
}

function main(): void {
  const plan = planBuild(process.env);
  console.log(`vercel-build: ${plan.mode} build (${plan.reason})`);
  for (const [command, ...args] of plan.steps) {
    console.log(`vercel-build: > ${[command, ...args].join(" ")}`);
    const result = spawnSync(command, args, { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
