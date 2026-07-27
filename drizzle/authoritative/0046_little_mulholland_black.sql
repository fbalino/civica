CREATE TABLE "atlas_entity_change_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "entity_table" text NOT NULL,
  "operation" text NOT NULL,
  "change_kind" text NOT NULL,
  "changes" jsonb NOT NULL,
  "reason" text NOT NULL,
  "methodology_version" text NOT NULL,
  "release_id" text NOT NULL,
  "correction_log_id" uuid,
  "correction_status" text,
  "recorded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "atlas_entity_change_history_identity_check" CHECK (
    btrim("atlas_entity_change_history"."entity_id") <> ''
    AND ("atlas_entity_change_history"."entity_type", "atlas_entity_change_history"."entity_table") IN (
      ('fact','country_facts'),
      ('institution','government_bodies'),
      ('office','offices'),
      ('person','persons'),
      ('election','elections'),
      ('constitution-passage','constitution_passages'),
      ('organization','organizations'),
      ('indicator','country_metrics')
    )
  ),
  CONSTRAINT "atlas_entity_change_history_event_check" CHECK (
    "atlas_entity_change_history"."operation" IN ('insert','update','delete')
    AND "atlas_entity_change_history"."change_kind" IN ('routine_refresh','substantive_revision','correction','retraction','methodology_change')
    AND jsonb_typeof("atlas_entity_change_history"."changes") = 'array'
    AND btrim("atlas_entity_change_history"."reason") <> ''
    AND btrim("atlas_entity_change_history"."methodology_version") <> ''
    AND "atlas_entity_change_history"."release_id" ~ '^[A-Za-z0-9._-]{1,96}$'
  ),
  CONSTRAINT "atlas_entity_change_history_correction_check" CHECK (
    ("atlas_entity_change_history"."correction_log_id" IS NULL AND "atlas_entity_change_history"."correction_status" IS NULL)
    OR ("atlas_entity_change_history"."correction_log_id" IS NOT NULL AND "atlas_entity_change_history"."correction_status" IN ('open','in_review','resolved_corrected','resolved_no_change','rejected'))
  )
);
--> statement-breakpoint
ALTER TABLE "atlas_entity_change_history"
  ADD CONSTRAINT "atlas_entity_change_history_correction_log_id_correction_log_id_fk"
  FOREIGN KEY ("correction_log_id") REFERENCES "public"."correction_log"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_atlas_entity_change_history_entity"
  ON "atlas_entity_change_history" USING btree ("entity_type","entity_id","recorded_at");
--> statement-breakpoint
CREATE INDEX "idx_atlas_entity_change_history_release"
  ON "atlas_entity_change_history" USING btree ("release_id");

-- civica-affected-relations: atlas_entity_change_history,correction_log
