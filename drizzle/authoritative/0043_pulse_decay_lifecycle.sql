-- PUL-027: preserve existing 365-day output history while permitting the
-- complete 730-day decay window required by the current taxonomy.
ALTER TABLE "pulse_dimensional_deltas"
  DROP CONSTRAINT "pulse_dimensional_deltas_window_check";
--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas"
  ADD CONSTRAINT "pulse_dimensional_deltas_window_check"
  CHECK (
    "pulse_dimensional_deltas"."window_days" IN (365, 730)
    AND "pulse_dimensional_deltas"."window_start" = "pulse_dimensional_deltas"."score_as_of" - "pulse_dimensional_deltas"."window_days"
  );
--> statement-breakpoint
ALTER TABLE "pulse_dimensional_delta_history"
  DROP CONSTRAINT "pulse_dimensional_delta_history_window_check";
--> statement-breakpoint
ALTER TABLE "pulse_dimensional_delta_history"
  ADD CONSTRAINT "pulse_dimensional_delta_history_window_check"
  CHECK (
    "pulse_dimensional_delta_history"."window_days" IN (365, 730)
    AND "pulse_dimensional_delta_history"."window_start" = "pulse_dimensional_delta_history"."score_as_of" - "pulse_dimensional_delta_history"."window_days"
  );

-- civica-affected-relations: pulse_dimensional_deltas,pulse_dimensional_delta_history
