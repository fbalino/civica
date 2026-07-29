import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local agent worktrees contain their own source and generated `.next`
    // trees; lint each worktree from its own root, never as nested input.
    ".claude/worktrees/**",
    "**/.venv/**",
  ]),
]);

export default eslintConfig;
