CREATE TABLE "pulse_event_jurisdictions" (
	"decision_key" text NOT NULL,
	"event_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"role" text NOT NULL,
	"rationale" text NOT NULL,
	"evidence_refs" text[] NOT NULL,
	"entity_snapshot" jsonb NOT NULL,
	"attribution_version" text NOT NULL,
	"entity_catalog_version" text NOT NULL,
	"entity_catalog_hash" text NOT NULL,
	"alias_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_event_jurisdictions_decision_key_jurisdiction_id_pk" PRIMARY KEY("decision_key","jurisdiction_id"),
	CONSTRAINT "pulse_event_jurisdictions_contract_check" CHECK ("pulse_event_jurisdictions"."role" IN ('primary','affected') AND "pulse_event_jurisdictions"."rationale" <> '' AND cardinality("pulse_event_jurisdictions"."evidence_refs") > 0 AND jsonb_typeof("pulse_event_jurisdictions"."entity_snapshot") = 'object' AND (("pulse_event_jurisdictions"."attribution_version" = 'pulse-jurisdiction-attribution/v2' AND "pulse_event_jurisdictions"."entity_catalog_version" = 'pulse-jurisdiction-entities/v1' AND "pulse_event_jurisdictions"."alias_version" = 'pulse-jurisdiction-aliases/v1' AND "pulse_event_jurisdictions"."entity_catalog_hash" ~ '^pulse-jurisdiction-entities/sha256:[a-f0-9]{64}$') OR ("pulse_event_jurisdictions"."attribution_version" = 'pulse-jurisdiction-attribution/legacy-projection-v1' AND "pulse_event_jurisdictions"."entity_catalog_version" = 'legacy-unversioned' AND "pulse_event_jurisdictions"."alias_version" = 'legacy-unversioned' AND "pulse_event_jurisdictions"."entity_catalog_hash" = 'legacy-unversioned')))
);
--> statement-breakpoint
ALTER TABLE "pulse_event_jurisdictions" ADD CONSTRAINT "pulse_event_jurisdictions_decision_key_pulse_event_decisions_decision_key_fk" FOREIGN KEY ("decision_key") REFERENCES "public"."pulse_event_decisions"("decision_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_jurisdictions" ADD CONSTRAINT "pulse_event_jurisdictions_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_jurisdictions" ADD CONSTRAINT "pulse_event_jurisdictions_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_event_jurisdictions_one_primary" ON "pulse_event_jurisdictions" USING btree ("decision_key") WHERE "pulse_event_jurisdictions"."role" = 'primary';--> statement-breakpoint
CREATE INDEX "idx_pulse_event_jurisdictions_event_role" ON "pulse_event_jurisdictions" USING btree ("event_id","role");--> statement-breakpoint
CREATE INDEX "idx_pulse_event_jurisdictions_jurisdiction_role" ON "pulse_event_jurisdictions" USING btree ("jurisdiction_id","role");
--> statement-breakpoint
ALTER TABLE pulse_event_decisions
  DROP CONSTRAINT pulse_event_decisions_contract_check;
--> statement-breakpoint
ALTER TABLE pulse_event_decisions
  ADD CONSTRAINT pulse_event_decisions_contract_check CHECK (
    schema_version = 'pulse-decision-ledger/v1'
    AND decision_key ~ '^pulse-decision/sha256:[a-f0-9]{64}$'
    AND kind IN ('event_existence','subject_attribution','category_labels','severity','calibration','corroboration','publication')
    AND verdict IN ('affirmed','refuted','abstained','unresolved')
    AND rationale <> ''
    AND jsonb_typeof(payload) = 'object'
    AND NOT (payload ? 'confidence')
    AND (
      (kind = 'event_existence' AND payload ? 'disposition')
      OR (kind = 'subject_attribution' AND payload ?& ARRAY['status','primaryJurisdictionId','affectedJurisdictionIds'])
      OR (kind = 'category_labels' AND payload ?& ARRAY['categoryIds','dimensionIds'])
      OR (kind = 'severity' AND payload ?& ARRAY['tier','value','direction'])
      OR (kind = 'calibration' AND payload ?& ARRAY['standing','signals','targetDecisionKinds','validationReleaseId'] AND payload->>'standing' = 'not_calibrated')
      OR (kind = 'corroboration' AND payload ?& ARRAY['independentEvidenceGroups','contributingReports','confidenceWeight','calibrationStanding'] AND payload->>'calibrationStanding' = 'heuristic_not_probability')
      OR (kind = 'publication' AND payload ?& ARRAY['eligible','origin','gateReasons'])
    )
    AND (
      kind <> 'subject_attribution'
      OR NOT (payload ? 'attributionVersion')
      OR (
        payload ?& ARRAY['attributionVersion','entityCatalogVersion','entityCatalogHash','aliasVersion','attributions']
        AND payload->>'attributionVersion' = 'pulse-jurisdiction-attribution/v2'
        AND payload->>'entityCatalogVersion' = 'pulse-jurisdiction-entities/v1'
        AND payload->>'aliasVersion' = 'pulse-jurisdiction-aliases/v1'
        AND payload->>'entityCatalogHash' ~ '^pulse-jurisdiction-entities/sha256:[a-f0-9]{64}$'
        AND jsonb_typeof(payload->'attributions') = 'array'
      )
    )
    AND jsonb_typeof(actor) = 'object'
    AND actor->>'type' IN ('classifier','verifier','subject_attributor','calibration_assessor','corroborator','publication_gate','human_reviewer','legacy_projection')
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION materialize_pulse_event_jurisdictions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
BEGIN
  IF NEW.kind <> 'subject_attribution'
     OR NEW.event_id IS NULL
     OR NEW.payload->>'attributionVersion' IS DISTINCT FROM 'pulse-jurisdiction-attribution/v2' THEN
    RETURN NEW;
  END IF;

  FOR item IN SELECT jsonb_array_elements(NEW.payload->'attributions')
  LOOP
    IF NOT (NEW.payload->'affectedJurisdictionIds' ? (item->>'jurisdictionId'))
       OR (item->>'role' = 'primary' AND item->>'jurisdictionId' IS DISTINCT FROM NEW.payload->>'primaryJurisdictionId') THEN
      RAISE EXCEPTION 'subject-attribution row is outside the declared projection';
    END IF;
    INSERT INTO pulse_event_jurisdictions (
      decision_key, event_id, cluster_id, jurisdiction_id, role, rationale,
      evidence_refs, entity_snapshot, attribution_version,
      entity_catalog_version, entity_catalog_hash, alias_version
    ) VALUES (
      NEW.decision_key,
      NEW.event_id,
      NEW.cluster_id,
      (item->>'jurisdictionId')::uuid,
      item->>'role',
      item->>'rationale',
      ARRAY(SELECT jsonb_array_elements_text(item->'evidenceRefs')),
      jsonb_build_object('jurisdictionId', item->>'jurisdictionId') || (item->'entity'),
      NEW.payload->>'attributionVersion',
      NEW.payload->>'entityCatalogVersion',
      NEW.payload->>'entityCatalogHash',
      NEW.payload->>'aliasVersion'
    );
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_event_decisions_materialize_jurisdictions
AFTER INSERT ON pulse_event_decisions
FOR EACH ROW EXECUTE FUNCTION materialize_pulse_event_jurisdictions();
--> statement-breakpoint
INSERT INTO pulse_event_jurisdictions (
  decision_key, event_id, cluster_id, jurisdiction_id, role, rationale,
  evidence_refs, entity_snapshot, attribution_version,
  entity_catalog_version, entity_catalog_hash, alias_version
)
SELECT
  d.decision_key,
  d.event_id,
  d.cluster_id,
  (d.payload->>'primaryJurisdictionId')::uuid,
  'primary',
  'Legacy single-jurisdiction projection; no versioned alias/entity input was retained.',
  CASE WHEN cardinality(d.evidence_refs) > 0 THEN d.evidence_refs ELSE ARRAY['legacy-projection']::text[] END,
  jsonb_build_object(
    'jurisdictionId', j.id::text,
    'canonicalName', j.name,
    'iso2', j.iso2,
    'iso3', j.iso3,
    'slug', j.slug,
    'aliases', '[]'::jsonb
  ),
  'pulse-jurisdiction-attribution/legacy-projection-v1',
  'legacy-unversioned',
  'legacy-unversioned',
  'legacy-unversioned'
FROM pulse_event_decisions d
JOIN jurisdictions j ON j.id = (d.payload->>'primaryJurisdictionId')::uuid
WHERE d.kind = 'subject_attribution'
  AND d.event_id IS NOT NULL
  AND d.payload->>'primaryJurisdictionId' IS NOT NULL
  AND NOT (d.payload ? 'attributionVersion')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_pulse_event_jurisdiction_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pulse_event_jurisdictions is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_event_jurisdictions_append_only
BEFORE UPDATE OR DELETE ON pulse_event_jurisdictions
FOR EACH ROW EXECUTE FUNCTION reject_pulse_event_jurisdiction_mutation();
