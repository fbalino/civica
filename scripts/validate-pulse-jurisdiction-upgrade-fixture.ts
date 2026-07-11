import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = neon(process.env.DATABASE_URL);
const decisionKey =
  "pulse-decision/sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

async function main() {
const [base] = await sql`
  SELECT
    e.id::text AS event_id,
    e.cluster_id::text,
    e.classification_run_id::text,
    p.id::text AS primary_id,
    p.name AS primary_name,
    p.iso2 AS primary_iso2,
    p.iso3 AS primary_iso3,
    p.slug AS primary_slug,
    a.id::text AS affected_id,
    a.name AS affected_name,
    a.iso2 AS affected_iso2,
    a.iso3 AS affected_iso3,
    a.slug AS affected_slug
  FROM pulse_events_v2 e
  JOIN jurisdictions p ON p.id = e.jurisdiction_id
  CROSS JOIN LATERAL (
    SELECT * FROM jurisdictions j
    WHERE j.id <> e.jurisdiction_id AND j.iso3 IS NOT NULL
    ORDER BY j.iso3
    LIMIT 1
  ) a
  LIMIT 1
`;
if (!base) throw new Error("fixture requires one event and two jurisdictions");

const payload = {
  status: "multiple",
  primaryJurisdictionId: String(base.primary_id),
  affectedJurisdictionIds: [String(base.primary_id), String(base.affected_id)],
  attributionVersion: "pulse-jurisdiction-attribution/v2",
  entityCatalogVersion: "pulse-jurisdiction-entities/v1",
  entityCatalogHash:
    "pulse-jurisdiction-entities/sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  aliasVersion: "pulse-jurisdiction-aliases/v1",
  attributions: [
    {
      jurisdictionId: String(base.primary_id),
      role: "primary",
      rationale: "Primary fixture role.",
      evidenceRefs: ["headline"],
      entity: {
        canonicalName: String(base.primary_name),
        iso2: base.primary_iso2,
        iso3: base.primary_iso3,
        slug: String(base.primary_slug),
        aliases: [],
      },
    },
    {
      jurisdictionId: String(base.affected_id),
      role: "affected",
      rationale: "Affected fixture role.",
      evidenceRefs: ["description"],
      entity: {
        canonicalName: String(base.affected_name),
        iso2: base.affected_iso2,
        iso3: base.affected_iso3,
        slug: String(base.affected_slug),
        aliases: [],
      },
    },
  ],
};
const actor = {
  type: "subject_attributor",
  provider: "fixture",
  model: "fixture",
  reviewerId: null,
};

let materializationPassed = false;
try {
  await sql.transaction([
    sql`
      INSERT INTO pulse_event_decisions (
        schema_version, decision_key, cluster_id, event_id, kind, verdict,
        payload, actor, stage_run_id, method_version, rationale,
        evidence_refs, decided_at
      ) VALUES (
        'pulse-decision-ledger/v1', ${decisionKey}, ${String(base.cluster_id)}::uuid,
        ${String(base.event_id)}::uuid, 'subject_attribution', 'affirmed',
        ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(actor)}::jsonb,
        ${String(base.classification_run_id)}::uuid, 'pulse-v2.8-beta',
        'Cross-border trigger fixture.', ARRAY['raw-event:fixture'], now()
      )
    `,
    sql.query(
      `DO $$
       BEGIN
         IF (SELECT count(*) FROM pulse_event_jurisdictions WHERE decision_key = '${decisionKey}') <> 2
            OR (SELECT count(*) FROM pulse_event_jurisdictions WHERE decision_key = '${decisionKey}' AND role = 'primary') <> 1
            OR (SELECT count(*) FROM pulse_event_jurisdictions WHERE decision_key = '${decisionKey}' AND role = 'affected') <> 1 THEN
           RAISE EXCEPTION 'PUL012_FIXTURE_BAD';
         END IF;
         RAISE EXCEPTION 'PUL012_FIXTURE_PASS';
       END $$`,
      [],
    ),
  ]);
} catch (error) {
  materializationPassed = String(error).includes("PUL012_FIXTURE_PASS");
}
if (!materializationPassed) throw new Error("cross-border trigger fixture failed");

let mutationGuardPassed = false;
try {
  await sql.transaction([
    sql.query(
      "UPDATE pulse_event_jurisdictions SET rationale = rationale WHERE decision_key = (SELECT decision_key FROM pulse_event_jurisdictions LIMIT 1)",
      [],
    ),
  ]);
} catch (error) {
  mutationGuardPassed = String(error).includes("append-only");
}
if (!mutationGuardPassed) throw new Error("append-only mutation fixture failed");

const [{ retained }] = await sql`
  SELECT count(*)::int AS retained
  FROM pulse_event_decisions
  WHERE decision_key = ${decisionKey}
`;
if (Number(retained) !== 0) throw new Error("rolled-back fixture decision was retained");

console.log("PASS — cross-border trigger created one primary plus one affected role, mutation was rejected, and the fixture rolled back with zero retained rows.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
