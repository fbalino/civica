import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

import {
  JURISDICTION_DIRECTORY_VERSION,
  buildJurisdictionDirectoryRows,
  type JurisdictionDirectoryArtifact,
  type JurisdictionDirectorySourceRow,
} from "../src/lib/jurisdictions/directory";
import { JURISDICTION_STATUS_TYPES } from "../src/lib/jurisdictions/status-taxonomy";
import { stableStringify } from "../src/lib/data/frozen-vintage";

const PATH = resolve(
  process.cwd(),
  "src/lib/jurisdictions/directory.generated.json",
);

const sha256 = (value: unknown) =>
  createHash("sha256").update(stableStringify(value)).digest("hex");

const errors: string[] = [];
const artifact = JSON.parse(
  readFileSync(PATH, "utf8"),
) as JurisdictionDirectoryArtifact;

// ── Checked-artifact integrity ──────────────────────────────────────────────
if (artifact.schemaVersion !== JURISDICTION_DIRECTORY_VERSION) {
  errors.push(`unexpected schema version ${artifact.schemaVersion}`);
}
if (!Number.isFinite(Date.parse(artifact.generatedAt))) {
  errors.push("generatedAt is not an ISO timestamp");
}
if (artifact.rowCount !== artifact.rows.length) {
  errors.push(
    `rowCount ${artifact.rowCount} disagrees with ${artifact.rows.length} rows`,
  );
}
if (artifact.rowsSha256 !== sha256(artifact.rows)) {
  errors.push("rowsSha256 does not match the checked rows");
}
const slugs = new Set(artifact.rows.map((row) => row.slug));
if (slugs.size !== artifact.rows.length) {
  errors.push("row slugs are not unique");
}
for (const row of artifact.rows) {
  if (!row.slug.trim() || !row.name.trim() || !row.statusLabel.trim()) {
    errors.push(`row ${row.slug || "<blank>"} has a blank required field`);
  }
  if (!(JURISDICTION_STATUS_TYPES as readonly string[]).includes(row.statusType)) {
    errors.push(`row ${row.slug} has unknown statusType ${row.statusType}`);
  }
}

// ── Live diff against the jurisdictions table ───────────────────────────────
// Runs only where DATABASE_URL is available (local work, Vercel builds). The
// credential-free CI build still enforces every integrity check above and
// reports an explicit skip so the live diff is never silently absent.
async function liveRows(): Promise<JurisdictionDirectorySourceRow[]> {
  const sql = neon(process.env.DATABASE_URL!);
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
  if (!process.env.DATABASE_URL) {
    if (errors.length > 0) {
      console.error(
        `✗ jurisdiction-directory integrity failed (${errors.length} error(s)):`,
      );
      for (const error of errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    console.log(
      `✓ ${JURISDICTION_DIRECTORY_VERSION}: ${artifact.rowCount} rows pass integrity checks. SKIP: live jurisdictions diff (no DATABASE_URL in this environment).`,
    );
    return;
  }

  const rebuilt = buildJurisdictionDirectoryRows(await liveRows());
  if (sha256(rebuilt) !== artifact.rowsSha256) {
    const checkedBySlug = new Map(artifact.rows.map((row) => [row.slug, row]));
    const liveBySlug = new Map(rebuilt.map((row) => [row.slug, row]));
    for (const slug of checkedBySlug.keys()) {
      if (!liveBySlug.has(slug)) errors.push(`checked row ${slug} is not in the live table`);
    }
    for (const [slug, live] of liveBySlug) {
      const checked = checkedBySlug.get(slug);
      if (!checked) {
        errors.push(`live row ${slug} is missing from the checked artifact`);
        continue;
      }
      if (stableStringify(checked) !== stableStringify(live)) {
        errors.push(
          `row ${slug} drifted: checked ${stableStringify(checked)} vs live ${stableStringify(live)}`,
        );
      }
    }
    if (errors.length === 0) {
      errors.push("live rows hash differs from the checked artifact (ordering drift)");
    }
  }

  if (errors.length > 0) {
    console.error(`✗ jurisdiction-directory validation failed (${errors.length} error(s)):`);
    for (const error of errors) console.error(`  - ${error}`);
    console.error(
      "  Regenerate with `npm run generate:jurisdiction-directory` if the live change is intentional.",
    );
    process.exit(1);
  }
  console.log(
    `✓ ${JURISDICTION_DIRECTORY_VERSION}: ${artifact.rowCount} rows match the live jurisdictions table.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
