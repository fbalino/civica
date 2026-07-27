-- PLT-014/DAT-035: migration 0036 registered the three named Index releases
-- before DAT-035 reconciled the checked source-input manifest metadata. Repair
-- only the exact untouched staging headers. A published or partially changed
-- header fails closed and requires a separately reviewed successor strategy.
LOCK TABLE ci_index_releases IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
DECLARE
  target_count integer;
  repairable_count integer;
  legacy_rules jsonb :=
    '[{"dimension":"democratic_quality","sourceId":"vdem","indicatorId":"v2x_libdem","priority":1,"artifactSha256":"bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b","upstreamRelease":"vdem 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip","substitutionReason":null},{"dimension":"democratic_quality","sourceId":"worldbank_wgi","indicatorId":"va.est","priority":2,"artifactSha256":"25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8","upstreamRelease":"worldbank_wgi 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://datacatalog.worldbank.org/public-licenses","substitutionReason":"Coverage substitution where the primary V-Dem indicator has no jurisdiction row."},{"dimension":"rule_of_law","sourceId":"worldbank_wgi","indicatorId":"rl.est","priority":1,"artifactSha256":"25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8","upstreamRelease":"worldbank_wgi 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://datacatalog.worldbank.org/public-licenses","substitutionReason":null},{"dimension":"freedom_rights","sourceId":"freedom_house","indicatorId":"fh_pr_cl_sum","priority":1,"artifactSha256":"d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88","upstreamRelease":"freedom_house 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx","substitutionReason":null},{"dimension":"corruption_control","sourceId":"transparency_intl","indicatorId":"CPI_SCORE","priority":1,"artifactSha256":"34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736","upstreamRelease":"transparency_intl 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx","substitutionReason":null}]'::jsonb;
BEGIN
  SELECT count(*)::integer
  INTO target_count
  FROM ci_index_releases
  WHERE id IN (
    'ci-beta-r3-2024-Q4',
    'ci-beta-r4-2024-Q4',
    'ci-beta-r5-2024-Q4'
  );

  -- A clean empty database has no seeded score rows or release headers.
  IF target_count = 0 THEN
    RETURN;
  END IF;
  IF target_count <> 3 THEN
    RAISE EXCEPTION
      'Index header repair expected all three named releases or none; found %',
      target_count;
  END IF;

  SELECT count(*)::integer
  INTO repairable_count
  FROM ci_index_releases
  WHERE id IN (
      'ci-beta-r3-2024-Q4',
      'ci-beta-r4-2024-Q4',
      'ci-beta-r5-2024-Q4'
    )
    AND status = 'staging'
    AND published_at IS NULL
    AND input_manifest_sha256 =
      'dc74a651c96ec770cd8128cb22c61d663f0b8192f9441ce55ff44f24966602cc'
    AND dimension_rules = legacy_rules;

  IF repairable_count <> 3 THEN
    RAISE EXCEPTION
      'Index header repair requires exactly three untouched staging headers; found %',
      repairable_count;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM ci_index_release_pointers
    WHERE release_id IN (
      'ci-beta-r3-2024-Q4',
      'ci-beta-r4-2024-Q4',
      'ci-beta-r5-2024-Q4'
    )
  ) THEN
    RAISE EXCEPTION 'Index header repair refuses a release selected by the public pointer';
  END IF;
END $$;
--> statement-breakpoint

-- The PLT-014 trigger deliberately freezes staging identity. Disable only that
-- trigger under the ACCESS EXCLUSIVE lock while replacing the two known stale
-- fields. Any error rolls the trigger state and the data change back together.
ALTER TABLE ci_index_releases
  DISABLE TRIGGER plt_014_guard_ci_release_header;
--> statement-breakpoint
DO $$
DECLARE
  repaired_count integer;
BEGIN
  UPDATE ci_index_releases AS release
  SET input_manifest_sha256 =
        '10fbdb56f5b579c6578786ed937b022be06142415d83fe274a171e93196e3434',
      dimension_rules = (
        SELECT jsonb_agg(rule.value ORDER BY
          rule.value->>'dimension',
          (rule.value->>'priority')::integer,
          rule.value->>'sourceId',
          rule.value->>'indicatorId'
        )
        FROM jsonb_array_elements(release.dimension_rules) AS rule(value)
      )
  WHERE release.id IN (
      'ci-beta-r3-2024-Q4',
      'ci-beta-r4-2024-Q4',
      'ci-beta-r5-2024-Q4'
    )
    AND release.status = 'staging'
    AND release.published_at IS NULL
    AND release.input_manifest_sha256 =
      'dc74a651c96ec770cd8128cb22c61d663f0b8192f9441ce55ff44f24966602cc';

  GET DIAGNOSTICS repaired_count = ROW_COUNT;
  IF repaired_count NOT IN (0, 3) THEN
    RAISE EXCEPTION
      'Index header repair changed an unexpected number of rows: %',
      repaired_count;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE ci_index_releases
  ENABLE TRIGGER plt_014_guard_ci_release_header;
--> statement-breakpoint

DO $$
DECLARE
  target_count integer;
  repaired_count integer;
BEGIN
  SELECT count(*)::integer
  INTO target_count
  FROM ci_index_releases
  WHERE id IN (
    'ci-beta-r3-2024-Q4',
    'ci-beta-r4-2024-Q4',
    'ci-beta-r5-2024-Q4'
  );

  IF target_count = 0 THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO repaired_count
  FROM ci_index_releases AS release
  WHERE release.id IN (
      'ci-beta-r3-2024-Q4',
      'ci-beta-r4-2024-Q4',
      'ci-beta-r5-2024-Q4'
    )
    AND release.status = 'staging'
    AND release.published_at IS NULL
    AND release.input_manifest_sha256 =
      '10fbdb56f5b579c6578786ed937b022be06142415d83fe274a171e93196e3434'
    AND release.dimension_rules = (
      SELECT jsonb_agg(rule.value ORDER BY
        rule.value->>'dimension',
        (rule.value->>'priority')::integer,
        rule.value->>'sourceId',
        rule.value->>'indicatorId'
      )
      FROM jsonb_array_elements(release.dimension_rules) AS rule(value)
    );

  IF repaired_count <> 3 THEN
    RAISE EXCEPTION
      'Index header repair postcondition expected three canonical staging headers; found %',
      repaired_count;
  END IF;
END $$;

-- civica-affected-relations: ci_index_release_pointers,ci_index_releases
