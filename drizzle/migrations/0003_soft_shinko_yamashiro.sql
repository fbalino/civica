CREATE TABLE "government_taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"taxonomy_version" text NOT NULL,
	"regime_type_cgv" text,
	"regime_dataset_version" text,
	"regime_year" integer,
	"structural_family" text,
	"structural_subtype" text,
	"is_federal" boolean,
	"is_monarchy" boolean,
	"executive_structure" text,
	"government_dependency" text,
	"override_note" text,
	"provenance" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "government_taxonomies" ADD CONSTRAINT "government_taxonomies_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_government_taxonomies_unique" ON "government_taxonomies" USING btree ("jurisdiction_id","taxonomy_version");--> statement-breakpoint
CREATE INDEX "idx_government_taxonomies_version" ON "government_taxonomies" USING btree ("taxonomy_version");--> statement-breakpoint
CREATE INDEX "idx_government_taxonomies_regime" ON "government_taxonomies" USING btree ("taxonomy_version","regime_type_cgv");--> statement-breakpoint
CREATE INDEX "idx_government_taxonomies_structural" ON "government_taxonomies" USING btree ("taxonomy_version","structural_family");