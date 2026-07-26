import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";

export const STAGING_STATIC_ASSET_SCHEMA_VERSION =
  "civica-staging-static-assets/v1" as const;

export interface StagingStaticAssetManifest {
  schemaVersion: typeof STAGING_STATIC_ASSET_SCHEMA_VERSION;
  rootKind: "vercel-build-output-static";
  fileCount: number;
  totalBytes: number;
  files: Array<{
    path: string;
    bytes: number;
    sha256: string;
  }>;
}

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

function relativeAssetPath(root: string, absolutePath: string) {
  return relative(root, absolutePath).split(sep).join("/");
}

function regularFiles(root: string, current = root): string[] {
  const files: string[] = [];
  for (const name of readdirSync(current).sort()) {
    const path = resolve(current, name);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      throw new Error(`Static asset manifest refuses symbolic link ${path}`);
    }
    if (info.isDirectory()) {
      files.push(...regularFiles(root, path));
    } else if (info.isFile()) {
      files.push(path);
    } else {
      throw new Error(`Static asset manifest refuses non-regular entry ${path}`);
    }
  }
  return files;
}

export function buildStagingStaticAssetManifest(
  rootPath: string,
): StagingStaticAssetManifest {
  const root = resolve(rootPath);
  if (!statSync(root).isDirectory()) {
    throw new Error(`Static asset root is not a directory: ${root}`);
  }
  const files = regularFiles(root)
    .map((path) => {
      const bytes = readFileSync(path);
      return {
        path: relativeAssetPath(root, path),
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      };
    })
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  if (files.length === 0) {
    throw new Error("Static asset manifest refuses an empty build output");
  }
  return {
    schemaVersion: STAGING_STATIC_ASSET_SCHEMA_VERSION,
    rootKind: "vercel-build-output-static",
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
}

export function serializeStagingStaticAssetManifest(
  manifest: StagingStaticAssetManifest,
) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function stagingStaticAssetManifestSha256(
  manifest: StagingStaticAssetManifest,
) {
  return sha256(serializeStagingStaticAssetManifest(manifest));
}

export function stagingStaticAssetManifestErrors(
  rootPath: string,
  expected: StagingStaticAssetManifest,
) {
  const errors: string[] = [];
  if (expected.schemaVersion !== STAGING_STATIC_ASSET_SCHEMA_VERSION) {
    errors.push(`unexpected schema version ${expected.schemaVersion}`);
  }
  const actual = buildStagingStaticAssetManifest(rootPath);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push("static build output differs from the checked manifest");
  }
  return errors;
}
