import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import { SOURCE_INPUT_SPECS } from "../src/lib/data/source-input-manifest";
import { sourceRights } from "../src/lib/rights/manifest";
import { CURRENT_PULSE_RUNTIME_METHOD } from "../src/lib/pulse/v2/runtime-contract";

config({ path: ".env.local" });

const requiredFragments: Record<string, string[]> = {
  "src/lib/db/schema.ts": [
    "evidenceIdentityKey",
    "evidenceContentHash",
    "evidenceLanguage",
    "evidencePublisher",
    "evidenceAttribution",
    "evidenceRights",
    "evidenceRetention",
    "raw_events_evidence_identity_check",
  ],
  "src/lib/pulse/v2/upsert.ts": [
    "buildPulseEvidenceIdentity",
    "retrievedAt: evidence[index].retrievedAt",
    "...evidence[index].identity",
  ],
  "src/lib/pulse/v2/evidence-identity.ts": [
    "pulse-raw-evidence/v1",
    "canonical-json/sha256-v1",
    'publicPayloadDistribution: "blocked"',
    "stored_payload_plus_content_hash",
  ],
  "drizzle/authoritative/0015_steep_cyclops.sql": [
    "PUL-005 cannot backfill",
    "pulse_raw_evidence_immutable",
    "raw Pulse evidence is append-only",
    "pulse_sources_raw_event_id_raw_events_id_fk",
  ],
  "src/lib/db/queries-pulse-v2.ts": [
    "evidenceIdentity",
    "evidenceContentHash",
    "JOIN raw_events re ON re.id = ps.raw_event_id",
  ],
  "src/lib/api/contract/schemas.ts": [
    "pulse-evidence\\/sha256",
    "zPulseEvidenceRights",
    "publicPayloadDistribution",
  ],
  "content/methodology-pulse.md": [
    "## Evidence identity {#evidence-identity}",
    "never the stored publisher payload",
    "Public payload redistribution is blocked",
  ],
};

function fail(message: string): never {
  throw new Error(`PUL-005 evidence-identity validation failed: ${message}`);
}

for (const [path, fragments] of Object.entries(requiredFragments)) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) fail(`${path} is missing ${fragment}`);
  }
}

for (const sourceId of CURRENT_PULSE_RUNTIME_METHOD.feeds.activeProduction
  .sourceIds) {
  if (!SOURCE_INPUT_SPECS.some((source) => source.sourceId === sourceId)) {
    fail(`active source ${sourceId} lacks a source-input contract`);
  }
  if (!sourceRights(sourceId))
    fail(`active source ${sourceId} lacks a rights contract`);
}

async function validateLive() {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL!);
  const [coverage] = await sql`
    SELECT
      count(*)::int AS raw_count,
      count(DISTINCT evidence_identity_key)::int AS identity_count,
      count(*) FILTER (WHERE source_url IS NULL OR retrieved_at IS NULL)::int AS missing_locator,
      count(*) FILTER (
        WHERE evidence_identity_key !~ '^pulse-evidence/sha256:[a-f0-9]{64}$'
           OR evidence_content_hash !~ '^[a-f0-9]{64}$'
           OR evidence_language = ''
      )::int AS invalid_identity,
      count(*) FILTER (
        WHERE evidence_publisher->>'schemaVersion' <> 'pulse-raw-evidence/v1'
           OR evidence_attribution->>'schemaVersion' <> 'pulse-raw-evidence/v1'
           OR evidence_rights->>'schemaVersion' <> 'pulse-raw-evidence/v1'
           OR evidence_retention->>'schemaVersion' <> 'pulse-raw-evidence/v1'
           OR evidence_retention->>'publicPayloadDistribution' <> 'blocked'
      )::int AS invalid_envelope,
      count(*) FILTER (
        WHERE evidence_rights->>'sourceId' IS DISTINCT FROM source_id
           OR evidence_publisher->>'sourceId' IS DISTINCT FROM source_id
      )::int AS source_mismatch
    FROM raw_events
  `;
  const [legacyHashes] = await sql`
    SELECT count(*)::int AS mismatches
    FROM raw_events
    WHERE evidence_retention->>'hashAlgorithm' = 'postgres-jsonb-text/sha256-legacy-v1'
      AND evidence_content_hash <> encode(digest(jsonb_build_object(
        'sourceId', source_id,
        'externalId', external_id,
        'sourceUrl', source_url,
        'eventDate', event_date,
        'title', title,
        'body', body,
        'raw', raw
      )::text, 'sha256'), 'hex')
  `;
  const [eventLinks] = await sql`
    SELECT
      count(*)::int AS link_count,
      count(*) FILTER (WHERE re.id IS NULL)::int AS missing_raw,
      count(*) FILTER (WHERE ps.source_id IS DISTINCT FROM re.source_id)::int AS source_mismatch
    FROM pulse_sources ps
    LEFT JOIN raw_events re ON re.id = ps.raw_event_id
  `;

  if (Number(coverage.raw_count) !== Number(coverage.identity_count)) {
    fail("raw evidence identities are not one-to-one");
  }
  for (const [label, value] of [
    ["missing locator", coverage.missing_locator],
    ["invalid identity", coverage.invalid_identity],
    ["invalid envelope", coverage.invalid_envelope],
    ["raw source mismatch", coverage.source_mismatch],
    ["legacy content-hash mismatch", legacyHashes.mismatches],
    ["event link missing raw evidence", eventLinks.missing_raw],
    ["event/raw source mismatch", eventLinks.source_mismatch],
  ] as const) {
    if (!Number.isSafeInteger(Number(value)) || Number(value) !== 0) {
      fail(`${label}: ${value}`);
    }
  }
  console.log(
    `Live: ${coverage.raw_count} raw snapshots, ${eventLinks.link_count} event-source links, zero missing or mismatched identities.`,
  );
}

async function main() {
  if (process.argv.includes("--live")) await validateLive();
  console.log(
    "PASS — pulse-raw-evidence/v1 seals exact locators, stored evidence, hashes, language state, publisher/source family, attribution evidence, and captured rights while blocking public payload redistribution.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
