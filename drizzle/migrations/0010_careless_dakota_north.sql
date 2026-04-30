CREATE TABLE "backtest_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"country_name" text NOT NULL,
	"country_iso3" text,
	"event_date" date NOT NULL,
	"description" text NOT NULL,
	"expected" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" text NOT NULL,
	"event_date" date NOT NULL,
	"source_id" text NOT NULL,
	"source_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"hint_category" text,
	"hint_dimension" text,
	"hint_severity_tier" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" text NOT NULL,
	"ran_at" timestamp DEFAULT now() NOT NULL,
	"param_snapshot" jsonb NOT NULL,
	"trajectory" jsonb NOT NULL,
	"verdict" text NOT NULL,
	"detail" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backtest_events" ADD CONSTRAINT "backtest_events_case_id_backtest_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."backtest_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_case_id_backtest_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."backtest_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backtest_events_case" ON "backtest_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_backtest_runs_case_ran" ON "backtest_runs" USING btree ("case_id","ran_at");