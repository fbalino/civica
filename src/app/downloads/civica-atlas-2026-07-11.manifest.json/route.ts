import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FILE = resolve(
  process.cwd(),
  "data/releases/atlas-2026-07-11/manifest.v1.json",
);

export async function GET() {
  return new Response(await readFile(FILE), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="civica-atlas-2026-07-11.manifest.json"',
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
