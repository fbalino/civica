import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const DAT_023_AUDIT_PATH = "plan/evidence/DAT-023/live-audit.json";
const DAT_023_AUDIT_SHA256 =
  "fc4a0019f0ea291b3b9df68da2b18aa43ec260f8ae7fa9592d14e7aca475811f";
const EXPECTED_DAT_023_AUDIT = {
  checkedAt: "2026-07-11",
  migration: "0025_immutable_frozen_vintages",
  atlas: {
    rows: 17_506,
    publishedLabel: "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1",
    storedMethodologyVersion: "v0.2-beta",
    versionMismatches: 0,
    nullContentHashes: 0,
    contentHashMismatches: 0,
  },
  civicaIndex: {
    namedRows: 237,
    versionMismatches: 0,
    periodMismatches: 0,
    nullContentHashes: 0,
    contentHashMismatches: 0,
  },
  databaseTriggers: {
    expected: 4,
    observed: 4,
    atlasMutationProbe: "rejected_and_rolled_back",
    indexMutationProbe: "rejected_and_rolled_back",
  },
  writesPerformedByAudit: 0,
} as const;

export interface FrozenVintageStaticInputs {
  snapshotSource: string;
  indexSource: string;
  legacyMigration: string;
  authoritativeBaseline: string;
  auditSource: string;
}

export interface FrozenVintageLiveRow {
  [key: string]: unknown;
}

function countDat023Triggers(source: string): number {
  return (
    source.match(
      /CREATE TRIGGER dat_023_(?:immutable_vintage|validate_vintage)\b/g,
    ) ?? []
  ).length;
}

export function frozenVintageStaticErrors(
  input: FrozenVintageStaticInputs,
): string[] {
  const errors: string[] = [];

  if (
    /insert\(countryFactVintages\)[\s\S]*?onConflictDoUpdate/.test(
      input.snapshotSource,
    )
  ) {
    errors.push("Atlas frozen writer still mutates conflicts");
  }
  for (const required of [
    "assertSupersession(",
    "stableStringify(",
    "contentHash",
    "Frozen vintage conflict",
    ".onConflictDoNothing()",
  ]) {
    if (!input.snapshotSource.includes(required)) {
      errors.push(`Atlas writer lacks ${required}`);
    }
  }

  for (const required of [
    "assertSupersession(",
    "stableStringify(",
    "indexContentHash(",
    "Frozen Civica Index conflict",
  ]) {
    if (!input.indexSource.includes(required)) {
      errors.push(`Index writer lacks ${required}`);
    }
  }
  if (
    !/if \(vintageLabel\) \{\s*await insert\.onConflictDoNothing\(\);\s*\} else \{\s*await insert\.onConflictDoUpdate\(/.test(
      input.indexSource,
    )
  ) {
    errors.push(
      "Index writer does not reserve conflict updates for unnamed live rows",
    );
  }

  const migrationRequirements = [
    "supersedes_vintage_label",
    "content_hash",
    "civica_reject_frozen_vintage_mutation",
    "civica_validate_frozen_vintage_insert",
    "Atlas vintage label and methodology_version disagree",
    "Civica Index vintage label, quarter, and methodology_version disagree",
  ];
  for (const required of migrationRequirements) {
    if (!input.legacyMigration.includes(required)) {
      errors.push(`legacy migration lacks ${required}`);
    }
    if (!input.authoritativeBaseline.includes(required)) {
      errors.push(`authoritative baseline lacks ${required}`);
    }
  }

  const legacyTriggers = countDat023Triggers(input.legacyMigration);
  if (legacyTriggers !== 4) {
    errors.push(
      `expected 4 DAT-023 triggers in legacy migration, found ${legacyTriggers}`,
    );
  }
  const authoritativeTriggers = countDat023Triggers(
    input.authoritativeBaseline,
  );
  if (authoritativeTriggers !== 4) {
    errors.push(
      `expected 4 DAT-023 triggers in authoritative baseline, found ${authoritativeTriggers}`,
    );
  }

  const auditSha256 = createHash("sha256")
    .update(input.auditSource)
    .digest("hex");
  if (auditSha256 !== DAT_023_AUDIT_SHA256) {
    errors.push(
      `DAT-023 checked audit SHA-256 drifted: expected ${DAT_023_AUDIT_SHA256}, found ${auditSha256}`,
    );
  }
  try {
    const audit: unknown = JSON.parse(input.auditSource);
    if (!isDeepStrictEqual(audit, EXPECTED_DAT_023_AUDIT)) {
      errors.push(
        "DAT-023 checked audit no longer matches the completed immutable-vintage evidence",
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`DAT-023 checked audit is not valid JSON: ${reason}`);
  }

  return errors;
}

export function frozenVintageLiveErrors(
  atlas: FrozenVintageLiveRow | undefined,
  index: FrozenVintageLiveRow | undefined,
  triggers: FrozenVintageLiveRow | undefined,
): string[] {
  const errors: string[] = [];
  const surfaces = [
    {
      name: "Atlas",
      row: atlas,
      mismatchFields: ["version_mismatches", "null_hashes", "hash_mismatches"],
    },
    {
      name: "Index",
      row: index,
      mismatchFields: [
        "version_mismatches",
        "period_mismatches",
        "null_hashes",
        "hash_mismatches",
      ],
    },
  ] as const;

  for (const surface of surfaces) {
    if (!surface.row) {
      errors.push(`${surface.name} live audit returned no row`);
      continue;
    }
    const total = Number(surface.row.total);
    if (!Number.isInteger(total) || total <= 0) {
      errors.push(
        `${surface.name} live audit returned invalid frozen row count: ${surface.row.total}`,
      );
    }
    for (const field of surface.mismatchFields) {
      const value = Number(surface.row[field]);
      if (value !== 0) {
        errors.push(`${surface.name} ${field}: ${surface.row[field]}`);
      }
    }
  }

  if (!triggers) {
    errors.push("live immutable-vintage trigger audit returned no row");
  } else if (Number(triggers.n) !== 4) {
    errors.push(
      `expected 4 live immutable-vintage triggers, found ${triggers.n}`,
    );
  }

  return errors;
}

function loadStaticInputs(): FrozenVintageStaticInputs {
  return {
    snapshotSource: readFileSync(
      "src/lib/factbook/reconcile/snapshot-vintage.ts",
      "utf8",
    ),
    indexSource: readFileSync("src/lib/ci/calculate-v2.ts", "utf8"),
    legacyMigration: readFileSync(
      "drizzle/migrations/0025_immutable_frozen_vintages.sql",
      "utf8",
    ),
    authoritativeBaseline: readFileSync(
      "drizzle/authoritative/0000_authoritative_baseline.sql",
      "utf8",
    ),
    auditSource: readFileSync(DAT_023_AUDIT_PATH, "utf8"),
  };
}

async function loadLiveAudit(): Promise<{
  atlas: FrozenVintageLiveRow | undefined;
  index: FrozenVintageLiveRow | undefined;
  triggers: FrozenVintageLiveRow | undefined;
}> {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required with --live");
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  const [atlas] =
    await sql`SELECT count(*)::int total, count(*) FILTER (WHERE v.methodology_version <> (regexp_match(v.vintage_label, '^Civica Atlas Reconciled (v[^[:space:]]+) — vintage ([0-9]{4}-Q[1-4])$'))[1])::int version_mismatches, count(*) FILTER (WHERE v.content_hash IS NULL)::int null_hashes, count(*) FILTER (WHERE r.completeness_status='canonical_only_legacy' AND v.content_hash <> encode(digest(v.source_id || '|' || coalesce(v.value_text, '') || '|' || coalesce(v.value_numeric::text, '') || '|' || coalesce(v.as_of::text, '') || '|' || v.methodology_version, 'sha256'), 'hex'))::int hash_mismatches FROM country_fact_vintages v JOIN country_fact_vintage_releases r ON r.vintage_label=v.vintage_label`;
  const [index] =
    await sql`SELECT count(*)::int total, count(*) FILTER (WHERE content_hash IS NULL)::int null_hashes, count(*) FILTER (WHERE lower(methodology_version) <> lower((regexp_match(vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \\(([^)]+)\\)$'))[3]))::int version_mismatches, count(*) FILTER (WHERE quarter <> (regexp_match(vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \\(([^)]+)\\)$'))[1] || '-Q' || (regexp_match(vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \\(([^)]+)\\)$'))[2])::int period_mismatches, count(*) FILTER (WHERE content_hash <> encode(digest(score::text || '|' || coalesce(score_lower::text, '') || '|' || coalesce(score_upper::text, '') || '|' || coalesce(completeness_flag, '') || '|' || coalesce(rank::text, '') || '|' || coalesce(total_ranked::text, '') || '|' || is_partial::text || '|' || dimensions_available::text || '|' || coalesce(array_to_string((select array_agg(x order by x) from unnest(missing_dimensions) x), ','), '') || '|' || methodology_version || '|' || derivation_version_key, 'sha256'), 'hex'))::int hash_mismatches FROM ci_composite_scores WHERE vintage_label IS NOT NULL`;
  const [triggers] =
    await sql`SELECT count(*)::int n FROM pg_trigger WHERE tgname IN ('dat_023_immutable_vintage','dat_023_validate_vintage') AND NOT tgisinternal`;
  return { atlas, index, triggers };
}

function reportErrors(errors: string[]): never {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

async function main(): Promise<void> {
  const staticErrors = frozenVintageStaticErrors(loadStaticInputs());
  if (staticErrors.length > 0) {
    reportErrors(staticErrors);
  }

  if (!process.argv.includes("--live")) {
    console.log(
      "Checked DAT-023 evidence: 17,506 Atlas rows; 237 named Index rows; 4/4 historical trigger probes.",
    );
    console.log(
      "PASS — frozen-vintage source, authoritative migration, and immutable DAT-023 evidence are consistent.",
    );
    console.log(
      "NOTICE — static mode does not inspect current Neon rows; run `npm run validate:frozen-vintages -- --live` for that comparison.",
    );
    return;
  }

  const live = await loadLiveAudit();
  const liveErrors = frozenVintageLiveErrors(
    live.atlas,
    live.index,
    live.triggers,
  );
  if (liveErrors.length > 0) {
    reportErrors(liveErrors);
  }
  console.log(
    `Live Atlas frozen rows: ${live.atlas?.total}; Index frozen rows: ${live.index?.total}; triggers: ${live.triggers?.n}/4`,
  );
  console.log(
    "PASS — live named vintages are version-consistent, hashed, append-only, and supersession-gated.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
