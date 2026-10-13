CREATE TABLE "page_cache_fingerprints" (
	"page_key" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"fingerprint_version" text NOT NULL,
	"rebuilt_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_cache_fingerprint_shape_check" CHECK (("page_cache_fingerprints"."page_key" = 'site' OR "page_cache_fingerprints"."page_key" ~ '^country:[0-9a-f-]{36}$') AND "page_cache_fingerprints"."fingerprint" ~ '^[a-f0-9]{64}$' AND length("page_cache_fingerprints"."fingerprint_version") BETWEEN 1 AND 64 AND "page_cache_fingerprints"."fingerprint_version" ~ '^[a-z0-9./-]+$')
);
