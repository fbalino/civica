ALTER TABLE "pulse_sources" DROP CONSTRAINT "pulse_sources_raw_event_id_raw_events_id_fk";
--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_identity_key" text;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_content_hash" text;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_language" text;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_publisher" jsonb;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_attribution" jsonb;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_rights" jsonb;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "evidence_retention" jsonb;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM raw_events
    WHERE source_url IS NULL
       OR source_id NOT IN ('gdelt', 'hrw', 'amnesty', 'civicus_monitor')
  ) THEN
    RAISE EXCEPTION 'PUL-005 cannot backfill a raw event without an exact URL and registered historical rights contract';
  END IF;
  IF EXISTS (SELECT 1 FROM pulse_sources WHERE raw_event_id IS NULL) THEN
    RAISE EXCEPTION 'PUL-005 cannot seal an event source without its raw evidence row';
  END IF;
END $$;--> statement-breakpoint
WITH evidence AS (
  SELECT
    r.id,
    encode(digest(jsonb_build_object(
      'sourceId', r.source_id,
      'externalId', r.external_id,
      'sourceUrl', r.source_url,
      'eventDate', r.event_date,
      'title', r.title,
      'body', r.body,
      'raw', r.raw
    )::text, 'sha256'), 'hex') AS content_hash,
    s.name AS source_name,
    CASE r.source_id
      WHEN 'gdelt' THEN 'https://api.gdeltproject.org/api/v2/doc/doc'
      WHEN 'hrw' THEN 'https://www.hrw.org/rss/news'
      WHEN 'amnesty' THEN 'https://www.amnesty.org/en/feed/'
      WHEN 'civicus_monitor' THEN 'https://monitor.civicus.org/RSSFeed.xml'
    END AS canonical_url,
    CASE r.source_id
      WHEN 'gdelt' THEN 'open-with-attribution'
      WHEN 'hrw' THEN 'restricted-no-redistribution'
      WHEN 'amnesty' THEN 'restricted-no-redistribution'
      WHEN 'civicus_monitor' THEN 'open-share-alike'
    END AS redistribution_posture,
    CASE r.source_id
      WHEN 'gdelt' THEN 'pending-review'
      WHEN 'hrw' THEN 'blocked'
      WHEN 'amnesty' THEN 'blocked'
      WHEN 'civicus_monitor' THEN 'pending-review'
    END AS public_export
  FROM raw_events r
  JOIN sources s ON s.id = r.source_id
)
UPDATE raw_events r SET
  evidence_content_hash = e.content_hash,
  evidence_identity_key = 'pulse-evidence/sha256:' || encode(digest(concat_ws('|', r.id::text, e.content_hash, r.retrieved_at::text), 'sha256'), 'hex'),
  evidence_language = CASE lower(COALESCE(r.raw->>'language', ''))
    WHEN 'english' THEN 'en'
    WHEN 'spanish' THEN 'es'
    WHEN 'french' THEN 'fr'
    WHEN 'german' THEN 'de'
    WHEN 'portuguese' THEN 'pt'
    WHEN 'indonesian' THEN 'id'
    WHEN 'arabic' THEN 'ar'
    WHEN 'russian' THEN 'ru'
    WHEN 'chinese' THEN 'zh'
    ELSE 'und'
  END,
  evidence_publisher = jsonb_build_object(
    'schemaVersion', 'pulse-raw-evidence/v1',
    'sourceId', r.source_id,
    'sourceFamilyId', r.source_id,
    'sourcePublisher', e.source_name,
    'sourceCanonicalUrl', e.canonical_url,
    'itemPublisherHost', COALESCE(NULLIF(r.raw->>'domain', ''), substring(r.source_url from '^https?://([^/]+)')),
    'sourceType', r.source_type
  ),
  evidence_attribution = jsonb_build_object(
    'schemaVersion', 'pulse-raw-evidence/v1',
    'methodVersion', 'legacy_unversioned',
    'status', CASE WHEN r.jurisdiction_id IS NULL THEN 'unresolved' ELSE 'resolved' END,
    'rawCountryName', r.raw_country_name,
    'jurisdictionId', r.jurisdiction_id,
    'evidence', CASE WHEN r.raw_country_name IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('kind', 'source_country_label', 'value', r.raw_country_name)) END
  ),
  evidence_rights = jsonb_build_object(
    'schemaVersion', 'pulse-raw-evidence/v1',
    'sourceId', r.source_id,
    'licenseId', 'PUBLISHER-TERMS-PENDING:' || e.redistribution_posture,
    'termsUrl', e.canonical_url,
    'reviewStatus', 'pending',
    'reviewedAt', NULL,
    'publicExport', e.public_export,
    'redistributionPosture', e.redistribution_posture,
    'restrictions', jsonb_build_array(
      'Source-specific terms have not completed DAT-003 verification',
      'Bulk export remains blocked until the terms record is verified'
    )
  ),
  evidence_retention = jsonb_build_object(
    'schemaVersion', 'pulse-raw-evidence/v1',
    'captureMode', 'full_internal_snapshot',
    'storedFields', jsonb_build_array('title', 'body', 'raw'),
    'storageRelation', 'raw_events',
    'publicPayloadDistribution', 'blocked',
    'hashAlgorithm', 'postgres-jsonb-text/sha256-legacy-v1',
    'linkRotProtection', 'stored_payload_plus_content_hash',
    'policyReason', 'Retained history predates PUL-005 identity generation. Its private fetched evidence is preserved without granting public payload redistribution.'
  )
FROM evidence e
WHERE e.id = r.id;--> statement-breakpoint
ALTER TABLE "pulse_sources" ALTER COLUMN "raw_event_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "source_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_identity_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_content_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_language" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_publisher" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_attribution" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_rights" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "evidence_retention" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_sources" ADD CONSTRAINT "pulse_sources_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_events_evidence_identity" ON "raw_events" USING btree ("evidence_identity_key");--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_evidence_identity_check" CHECK ("raw_events"."evidence_identity_key" ~ '^pulse-evidence/sha256:[a-f0-9]{64}$' AND "raw_events"."evidence_content_hash" ~ '^[a-f0-9]{64}$' AND "raw_events"."evidence_language" <> '' AND "raw_events"."evidence_publisher"->>'schemaVersion' = 'pulse-raw-evidence/v1' AND "raw_events"."evidence_attribution"->>'schemaVersion' = 'pulse-raw-evidence/v1' AND "raw_events"."evidence_rights"->>'schemaVersion' = 'pulse-raw-evidence/v1' AND "raw_events"."evidence_retention"->>'schemaVersion' = 'pulse-raw-evidence/v1' AND "raw_events"."evidence_retention"->>'publicPayloadDistribution' = 'blocked');--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_protect_pulse_raw_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'raw Pulse evidence is append-only';
  END IF;
  IF NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.external_id IS DISTINCT FROM OLD.external_id
     OR NEW.source_url IS DISTINCT FROM OLD.source_url
     OR NEW.source_type IS DISTINCT FROM OLD.source_type
     OR NEW.jurisdiction_id IS DISTINCT FROM OLD.jurisdiction_id
     OR NEW.raw_country_name IS DISTINCT FROM OLD.raw_country_name
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.retrieved_at IS DISTINCT FROM OLD.retrieved_at
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.raw IS DISTINCT FROM OLD.raw
     OR NEW.evidence_identity_key IS DISTINCT FROM OLD.evidence_identity_key
     OR NEW.evidence_content_hash IS DISTINCT FROM OLD.evidence_content_hash
     OR NEW.evidence_language IS DISTINCT FROM OLD.evidence_language
     OR NEW.evidence_publisher IS DISTINCT FROM OLD.evidence_publisher
     OR NEW.evidence_attribution IS DISTINCT FROM OLD.evidence_attribution
     OR NEW.evidence_rights IS DISTINCT FROM OLD.evidence_rights
     OR NEW.evidence_retention IS DISTINCT FROM OLD.evidence_retention THEN
    RAISE EXCEPTION 'raw Pulse evidence identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS pulse_raw_evidence_immutable ON "raw_events";--> statement-breakpoint
CREATE TRIGGER pulse_raw_evidence_immutable
BEFORE UPDATE OR DELETE ON "raw_events"
FOR EACH ROW EXECUTE FUNCTION civica_protect_pulse_raw_evidence();
