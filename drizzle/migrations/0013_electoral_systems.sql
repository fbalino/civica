-- Electoral-systems capture — per-chamber IPU Parline classification.
-- Plan: plan/electoral-systems-implementation-v1.md
--
-- Adds two nullable columns to `government_bodies` for the electoral-system
-- family and sub-type as classified by IPU Parline (stored as IPU's own
-- snake_case terms verbatim — no invented taxonomy). Populated by
-- `scripts/sync-ipu-parline.ts`; consumed by `/elections/systems`.
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than drizzle-kit-generated
-- because the repo's drizzle snapshot baseline is out of sync with the live DB
-- (a pre-existing Phase F state issue, not in this change's scope — see the
-- matching note in 0012_bug1_value_type.sql). The live columns were already
-- applied via `drizzle-kit push`; this file records the change idempotently.

ALTER TABLE "government_bodies"
  ADD COLUMN IF NOT EXISTS "electoral_system_family" text;
--> statement-breakpoint

ALTER TABLE "government_bodies"
  ADD COLUMN IF NOT EXISTS "electoral_subsystem" text;
