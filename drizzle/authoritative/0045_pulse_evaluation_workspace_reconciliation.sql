ALTER TABLE "pulse_coding_studies"
  ADD COLUMN "supersedes_study_id" uuid,
  ADD COLUMN "supersession_reason" text;
--> statement-breakpoint
ALTER TABLE "pulse_coding_studies"
  ADD CONSTRAINT "pulse_coding_studies_supersedes_study_id_pulse_coding_studies_id_fk"
  FOREIGN KEY ("supersedes_study_id") REFERENCES "public"."pulse_coding_studies"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pulse_coding_studies"
  ADD CONSTRAINT "pulse_coding_studies_supersession_check"
  CHECK (
    ("supersedes_study_id" IS NULL AND "supersession_reason" IS NULL)
    OR (
      "supersedes_study_id" IS NOT NULL
      AND "supersession_reason" = 'frozen_packet_hash_mismatch'
      AND "id" <> "supersedes_study_id"
    )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_study_supersedes"
  ON "pulse_coding_studies" USING btree ("supersedes_study_id");

-- civica-affected-relations: pulse_coding_studies
