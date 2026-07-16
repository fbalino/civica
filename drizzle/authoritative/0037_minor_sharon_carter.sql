CREATE TABLE "route_performance_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"route_id" text NOT NULL,
	"method" text NOT NULL,
	"surface" text NOT NULL,
	"metric" text NOT NULL,
	"duration_ms" integer,
	"http_status" integer,
	"cache_profile" text,
	"release_id" text NOT NULL,
	"telemetry_version" text NOT NULL,
	CONSTRAINT "route_performance_observation_route_shape" CHECK (length("route_performance_observations"."route_id") BETWEEN 1 AND 160 AND "route_performance_observations"."route_id" ~ '^[a-z][a-z0-9._-]*$'),
	CONSTRAINT "route_performance_observation_method_closed" CHECK ("route_performance_observations"."method" IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','DOCUMENT','UNKNOWN')),
	CONSTRAINT "route_performance_observation_surface_metric_closed" CHECK (("route_performance_observations"."surface" = 'request' AND "route_performance_observations"."metric" = 'request_duration_ms' AND "route_performance_observations"."duration_ms" IS NOT NULL) OR ("route_performance_observations"."surface" = 'job' AND "route_performance_observations"."metric" = 'job_duration_ms' AND "route_performance_observations"."duration_ms" IS NOT NULL) OR ("route_performance_observations"."surface" = 'error' AND "route_performance_observations"."metric" = 'server_error' AND "route_performance_observations"."duration_ms" IS NULL)),
	CONSTRAINT "route_performance_observation_duration_bound" CHECK ("route_performance_observations"."duration_ms" IS NULL OR "route_performance_observations"."duration_ms" BETWEEN 0 AND 3600000),
	CONSTRAINT "route_performance_observation_status_bound" CHECK ("route_performance_observations"."http_status" IS NULL OR "route_performance_observations"."http_status" BETWEEN 100 AND 599),
	CONSTRAINT "route_performance_observation_cache_profile_closed" CHECK ("route_performance_observations"."cache_profile" IS NULL OR "route_performance_observations"."cache_profile" IN ('public-live','private-live','checked-build-artifact','immutable-release','build-static','build-revalidated','document')),
	CONSTRAINT "route_performance_observation_release_shape" CHECK (length("route_performance_observations"."release_id") BETWEEN 1 AND 96 AND "route_performance_observations"."release_id" ~ '^[a-zA-Z0-9._-]+$' AND length("route_performance_observations"."telemetry_version") BETWEEN 1 AND 96 AND "route_performance_observations"."telemetry_version" ~ '^[a-zA-Z0-9._/-]+$')
);
--> statement-breakpoint
CREATE INDEX "idx_route_performance_observed_at" ON "route_performance_observations" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "idx_route_performance_route_metric_time" ON "route_performance_observations" USING btree ("route_id","metric","observed_at");--> statement-breakpoint
CREATE INDEX "idx_route_performance_release_time" ON "route_performance_observations" USING btree ("release_id","observed_at");