import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FILE = resolve(
  process.cwd(),
  "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
);

export async function GET() {
  const body = await readFile(FILE);
  return new Response(body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition":
        'attachment; filename="civica-atlas-2026-07-11.json.gz"',
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
