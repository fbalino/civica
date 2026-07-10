-- DAT-012: make Pulse cluster classification retries converge.
ALTER TABLE "pulse_events_v2" ADD COLUMN "cluster_id" uuid;
UPDATE "pulse_events_v2"
SET "cluster_id" = "id"
WHERE "cluster_id" IS NULL;
ALTER TABLE "pulse_events_v2" ALTER COLUMN "cluster_id" SET NOT NULL;
CREATE UNIQUE INDEX "idx_pulse_v2_cluster_unique"
  ON "pulse_events_v2" ("cluster_id");
CREATE UNIQUE INDEX "idx_pulse_sources_raw_event_unique"
  ON "pulse_sources" ("raw_event_id")
  WHERE "raw_event_id" IS NOT NULL;
