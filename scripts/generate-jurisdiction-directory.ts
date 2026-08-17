import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

import {
  JURISDICTION_DIRECTORY_VERSION,
  buildJurisdictionDirectoryRows,
  type JurisdictionDirectoryArtifact,
  type JurisdictionDirectorySourceRow,
} from "../src/lib/jurisdictions/directory";
import { stableStringify } from "../src/lib/data/frozen-vintage";

const OUTPUT = resolve(
  process.cwd(),
  "src/lib/jurisdictions/directory.generated.json",
);

const sha256 = (value: unknown) =>
  createHash("sha256").update(stableStringify(value)).digest("hex");

async function loadSourceRows(): Promise<JurisdictionDirectorySourceRow[]> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT slug, name, iso2, iso3, type,
           status_source_ids AS "statusSourceIds",
           status_reviewed_at::text AS "statusReviewedAt",
           status_note AS "statusNote",
           administering_jurisdiction_iso3 AS "administeringJurisdictionIso3",
           status_disputed AS "statusDisputed",
           capital
    FROM jurisdictions
    WHERE LOWER(name) <> 'none'
    ORDER BY name ASC`;
  return rows as JurisdictionDirectorySourceRow[];
}

async function main() {
  const rows = buildJurisdictionDirectoryRows(await loadSourceRows());
  const rowsSha256 = sha256(rows);

  // Content-identical reruns are byte-identical no-ops: keep the checked
  // generatedAt when the derived rows have not changed (DAT-012 discipline).
  if (existsSync(OUTPUT)) {
    const existing = JSON.parse(
      readFileSync(OUTPUT, "utf8"),
    ) as JurisdictionDirectoryArtifact;
    if (
      existing.schemaVersion === JURISDICTION_DIRECTORY_VERSION &&
      existing.rowsSha256 === rowsSha256 &&
      sha256(existing.rows) === rowsSha256
    ) {
      console.log(
        `${JURISDICTION_DIRECTORY_VERSION}: unchanged (${rows.length} rows, sha ${rowsSha256.slice(0, 12)}…); no write.`,
      );
      return;
    }
  }

  const artifact: JurisdictionDirectoryArtifact = {
    schemaVersion: JURISDICTION_DIRECTORY_VERSION,
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    rowsSha256,
    rows,
  };
  writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(
    `Wrote ${JURISDICTION_DIRECTORY_VERSION}: ${rows.length} rows, sha ${rowsSha256.slice(0, 12)}….`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
