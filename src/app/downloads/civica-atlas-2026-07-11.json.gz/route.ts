import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { immutableArtifactResponse } from "@/lib/api/artifact-response";

const FILE = resolve(
  process.cwd(),
  "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
);

export async function GET() {
  return immutableArtifactResponse({
    operation: "atlas-export-download",
    filename: "civica-atlas-2026-07-11.json.gz",
    contentType: "application/gzip",
    load: () => readFile(FILE),
  });
}
