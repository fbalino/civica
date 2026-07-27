import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { immutableArtifactResponse } from "@/lib/api/artifact-response";

const FILE = resolve(
  process.cwd(),
  "data/releases/atlas-2026-07-11/manifest.v1.json",
);

export async function GET() {
  return immutableArtifactResponse({
    operation: "atlas-export-manifest-download",
    filename: "civica-atlas-2026-07-11.manifest.json",
    contentType: "application/json; charset=utf-8",
    load: () => readFile(FILE),
  });
}
