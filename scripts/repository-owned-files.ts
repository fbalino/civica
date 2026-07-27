import { execFileSync } from "node:child_process";
import path from "node:path";

function posix(value: string): string {
  return value.split(path.sep).join("/");
}

/**
 * Return the source set Git records for the repository. CI can ship only this
 * set, so local untracked experiments are not product route/page surfaces.
 * A source archive without Git metadata falls back to the on-disk walk.
 */
export function loadRepositoryOwnedFiles(
  root = process.cwd(),
): ReadonlySet<string> | null {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return new Set(
      output
        .split("\0")
        .map((file) => posix(file.trim()))
        .filter(Boolean),
    );
  } catch {
    return null;
  }
}

export function isRepositoryOwned(
  repoRelativePath: string,
  ownedFiles: ReadonlySet<string> | null,
): boolean {
  return ownedFiles === null || ownedFiles.has(posix(repoRelativePath));
}
