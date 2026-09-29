/**
 * validate-publisher-attribution-live — CLM-020 read-only live check.
 *
 *   DATABASE_URL=<injected> npm run validate:publisher-attribution:live -- \
 *     [--write=plan/evidence/CLM-020/publisher-attribution-live-<date>.json]
 *
 * Every query runs inside one READ ONLY, REPEATABLE READ transaction; the
 * script never writes. It applies the production shapers and the
 * publisher-attribution/v1 value checks to the rows the reader surfaces use
 * and compares them with Civica's independent retained copies of the
 * publisher figures:
 *
 *   - V-Dem: every frozen-release row against the K1 v2 exact-publisher panel;
 *   - Freedom House: every release row's status against Freedom House's rule
 *     applied to the K1 v2 panel ratings (this proves the two retained copies
 *     agree; Freedom House's own Status column is not captured);
 *   - the former "Free (N/100)" row, rebuilt from stored values, must fail;
 *   - the sample's row presence, v2 keys, clocks, and rights-filtered API rows;
 *   - Conditions: every scored position carries a registered scoreOrigin and
 *     replays from its component; Human Development year labels are compared
 *     with the prior year of the same retained series.
 *
 * Exit 0 only when every failure matches a registered live exception and every
 * registered exception matches at least one failure.
 */

import { writeFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

import { shapeConditionsReleaseResponse } from "../src/lib/api/contract/shapes";
import { CURRENT_CI_RELEASE_ID } from "../src/lib/ci/current-release";
import { governanceEvidenceRights } from "../src/lib/ci/governance-evidence";
import {
  buildConditionsPublicRelease,
  selectConditionsPublicRelease,
  type ConditionsPublicComponent,
  type ConditionsStoredCalculation,
} from "../src/lib/conditions/public-release";
import {
  FREEDOM_HOUSE_STATUS_RULE,
  RELEASE_PUBLISHER_INPUTS,
  shapeFreedomHouseScoreRow,
  shapePublicCountryScores,
  shapeVdemScoreRow,
  type ScoreRow,
} from "../src/lib/ci/publisher-scores";
import {
  civicaCalculationDisclosure,
  fixedBoundPosition,
} from "../src/lib/provenance/publisher-attribution";
import {
  legacyFreedomHouseRow,
  publisherAttributionErrors,
  scaleEndClusterSignature,
  scoreRowAttributionErrors,
} from "../src/lib/provenance/publisher-attribution-check";
import {
  LIVE_CHECK_EXCEPTIONS,
  PUBLISHER_ATTRIBUTION_LIVE_SAMPLE,
} from "../src/lib/provenance/publisher-attribution-registry";

const K1_PANEL_RELEASE = "ci-k1-uncertainty-inputs-2024-v2";
const V2_KEYS = [
  "category",
  "freshness",
  "id",
  "label",
  "observationPeriod",
  "observationPeriodLabel",
  "publisherEdition",
  "release",
  "retrievedAt",
  "score",
  "scoreFormatted",
  "source",
  "valueOrigin",
].sort();

type CheckStatus = "pass" | "fail" | "unverified";

interface CheckResult {
  id: string;
  status: CheckStatus;
  counts: Record<string, number>;
  examples: string[];
  note: string;
  scope?: { releaseId: string; componentId: string };
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("injected_database_url_required");
  return value;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(text(value));
  return date.toISOString();
}

const formatPosition = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

async function loadRows(databaseUrl: string) {
  const sql = neon(databaseUrl, { readOnly: true, isolationLevel: "RepeatableRead" });
  const [
    clockRows,
    releaseRows,
    panelRows,
    sampleRows,
    conditionsReleaseRows,
    fhTotalRows,
  ] = await sql.transaction((transaction) => [
    transaction`SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS checked_at`,
    transaction`
      SELECT j.slug, cds.source_id, cds.dimension, cds.raw_value, cds.normalized_score
      FROM ci_dimension_scores cds
      JOIN jurisdictions j ON j.id = cds.jurisdiction_id
      WHERE cds.release_id = ${CURRENT_CI_RELEASE_ID}
        AND ((cds.dimension = 'democratic_quality' AND cds.source_id = 'vdem')
          OR (cds.dimension = 'freedom_rights' AND cds.source_id = 'freedom_house'))
      ORDER BY j.slug, cds.source_id`,
    transaction`
      SELECT j.slug, p.indicator_id, p.value, p.source_vintage
      FROM ci_research_panel_rows p
      JOIN jurisdictions j ON j.id = p.jurisdiction_id
      WHERE p.release_id = ${K1_PANEL_RELEASE}
        AND p.indicator_id IN ('v2x_libdem', 'pr_cl_total')
        AND p.value IS NOT NULL
      ORDER BY j.slug, p.indicator_id`,
    transaction`
      SELECT j.slug, cds.source_id, cds.dimension
      FROM jurisdictions j
      LEFT JOIN ci_dimension_scores cds
        ON cds.jurisdiction_id = j.id AND cds.release_id = ${CURRENT_CI_RELEASE_ID}
      WHERE j.slug = ANY(${[...PUBLISHER_ATTRIBUTION_LIVE_SAMPLE]})
      ORDER BY j.slug, cds.source_id`,
    transaction`
      SELECT id AS release_id, methodology_version, manifest_sha256, created_at
      FROM civica_conditions_releases
      ORDER BY created_at DESC, id DESC`,
    transaction`
      SELECT value FROM indicator_history
      WHERE indicator = 'fh_total_score' AND year = ${RELEASE_PUBLISHER_INPUTS.freedom_house.observationPeriod}::int`,
  ]);
  const releases = conditionsReleaseRows.map((row) => ({
    releaseId: text(row.release_id),
    methodologyVersion: text(row.methodology_version),
    manifestSha256: text(row.manifest_sha256),
    createdAt: iso(row.created_at),
  }));
  const conditionsHeader = selectConditionsPublicRelease(releases);
  if (!conditionsHeader) throw new Error("no Conditions release is stored");
  const [calculationRows, componentRows, hdiSeriesRows, hdiHistoryRows] = await sql.transaction(
    (transaction) => [
      transaction`
        SELECT calculation.calculation_key, calculation.release_id,
          calculation.jurisdiction_id::text AS jurisdiction_id,
          jurisdiction.name AS country_name, jurisdiction.slug AS country_slug,
          jurisdiction.iso3 AS country_iso3, calculation.dimension,
          calculation.alignment_policy, calculation.alignment_status,
          calculation.reference_year, score.normalized_score, score.raw_value,
          score.transformation_id AS score_transformation_id,
          score.source_id AS score_source_id, score_source.name AS score_source_name,
          score.indicator_id AS score_indicator_id,
          score.upstream_release AS score_upstream_release,
          score.license_url AS score_license_url
        FROM civica_conditions_calculations calculation
        JOIN jurisdictions jurisdiction ON jurisdiction.id = calculation.jurisdiction_id
        LEFT JOIN civica_conditions_scores score
          ON score.calculation_key = calculation.calculation_key
          AND score.release_id = ${conditionsHeader.releaseId}
        LEFT JOIN sources score_source ON score_source.id = score.source_id
        WHERE calculation.release_id = ${conditionsHeader.releaseId}
          AND jurisdiction.type = 'sovereign_state'
        ORDER BY jurisdiction.name, calculation.dimension`,
      transaction`
        SELECT component.calculation_key, component.component_id, component.native_value,
          component.native_unit, component.reference_year, component.value_status,
          component.value_status_reason, component.inclusion_decision, component.source_id,
          source.name AS source_name, component.indicator_id, component.upstream_release,
          component.license_url, component.transformation_id, jurisdiction.slug
        FROM civica_conditions_components component
        JOIN civica_conditions_calculations calculation
          ON calculation.calculation_key = component.calculation_key
        LEFT JOIN sources source ON source.id = component.source_id
        JOIN jurisdictions jurisdiction ON jurisdiction.id = calculation.jurisdiction_id
        WHERE calculation.release_id = ${conditionsHeader.releaseId}
          AND jurisdiction.type = 'sovereign_state'
        ORDER BY component.calculation_key, component.component_id`,
      transaction`
        SELECT j.slug, cds.quarter, cds.raw_value
        FROM ci_dimension_scores cds
        JOIN jurisdictions j ON j.id = cds.jurisdiction_id
        WHERE cds.source_id = 'undp_hdi' AND cds.release_id IS NULL
        ORDER BY j.slug, cds.quarter`,
      transaction`
        SELECT j.slug, h.year, h.value
        FROM indicator_history h
        JOIN jurisdictions j ON j.id = h.jurisdiction_id
        WHERE h.indicator = 'hdi'
        ORDER BY j.slug, h.year`,
    ],
  );
  return {
    checkedAt: text(clockRows[0]?.checked_at),
    releaseRows,
    panelRows,
    sampleRows,
    conditionsHeader,
    calculationRows,
    componentRows,
    hdiSeriesRows,
    hdiHistoryRows,
    fhTotalRows,
  };
}

async function main(): Promise<void> {
  const writeArgument = process.argv.find((argument) => argument.startsWith("--write="));
  const data = await loadRows(requiredDatabaseUrl());
  const checks: CheckResult[] = [];

  const panel = new Map<string, number>();
  for (const row of data.panelRows) {
    const indicator = text(row.indicator_id);
    if (indicator === "v2x_libdem" && text(row.source_vintage) !== "exact 2024 publisher release") continue;
    panel.set(`${text(row.slug)}:${indicator}`, num(row.value)!);
  }
  const vdemRows = data.releaseRows.filter((row) => text(row.source_id) === "vdem");
  const fhRows = data.releaseRows.filter((row) => text(row.source_id) === "freedom_house");

  // 1. V-Dem value equals the exact retained publisher figure.
  {
    const examples: string[] = [];
    let joined = 0;
    let failed = 0;
    for (const row of vdemRows) {
      const slug = text(row.slug);
      const shaped = shapeVdemScoreRow(num(row.raw_value)!);
      const retained = panel.get(`${slug}:v2x_libdem`);
      if (retained === undefined) continue;
      joined += 1;
      const errors = [
        ...scoreRowAttributionErrors(shaped, retained),
        ...(shaped.scoreFormatted === retained.toFixed(3)
          ? []
          : [`shows ${shaped.scoreFormatted}; retained figure ${retained.toFixed(3)}`]),
      ];
      if (errors.length > 0) {
        failed += 1;
        if (examples.length < 5) examples.push(`${slug}: ${errors.join("; ")}`);
      }
    }
    checks.push({
      id: "country-scores.vdem.matches-publisher",
      status: failed === 0 && joined > 0 ? "pass" : "fail",
      counts: { releaseRows: vdemRows.length, joinedToRetainedCopy: joined, failed, withoutRetainedCopy: vdemRows.length - joined },
      examples,
      note: "Every frozen-release V-Dem row, shaped for display, equals V-Dem's own figure in the K1 v2 exact-publisher panel at three decimals.",
    });
  }

  // 2. Freedom House status equals Freedom House's rule on the retained ratings.
  {
    const examples: string[] = [];
    let joined = 0;
    let failed = 0;
    const statusCounts: Record<string, number> = {};
    for (const row of fhRows) {
      const slug = text(row.slug);
      const shaped = shapeFreedomHouseScoreRow(num(row.raw_value)!);
      statusCounts[shaped.category!] = (statusCounts[shaped.category!] ?? 0) + 1;
      const retained = panel.get(`${slug}:pr_cl_total`);
      if (retained === undefined) continue;
      joined += 1;
      const errors = [
        ...scoreRowAttributionErrors(shaped, retained),
        ...(shaped.category === FREEDOM_HOUSE_STATUS_RULE.apply(retained)
          ? []
          : [`status ${shaped.category}; rule on retained ratings gives ${FREEDOM_HOUSE_STATUS_RULE.apply(retained)}`]),
      ];
      if (errors.length > 0) {
        failed += 1;
        if (examples.length < 5) examples.push(`${slug}: ${errors.join("; ")}`);
      }
    }
    checks.push({
      id: "country-scores.fh.rule-applied",
      status: failed === 0 && joined > 0 ? "pass" : "fail",
      counts: { releaseRows: fhRows.length, joinedToRetainedCopy: joined, failed, ...statusCounts },
      examples,
      note: "Every Freedom House row shows no number, and its status equals Freedom House's published rule applied to the K1 v2 retained ratings. This proves two retained copies agree; Freedom House's own Status column is not captured (follow-up F7).",
    });
  }

  // 3. The former formatter's output, rebuilt from stored values, must fail.
  {
    let flagged = 0;
    const examples: string[] = [];
    for (const row of fhRows) {
      const raw = num(row.raw_value)!;
      const legacy = legacyFreedomHouseRow(FREEDOM_HOUSE_STATUS_RULE.apply(raw), num(row.normalized_score)!);
      const errors = scoreRowAttributionErrors(legacy, raw);
      if (errors.length > 0) flagged += 1;
      if (["uruguay", "brazil", "hungary", "china"].includes(text(row.slug))) {
        examples.push(`${text(row.slug)}: former text "${legacy.scoreFormatted}" → ${errors[1] ?? errors[0]}`);
      }
    }
    checks.push({
      id: "country-scores.legacy-row-rejected",
      status: flagged === fhRows.length ? "pass" : "fail",
      counts: { releaseRows: fhRows.length, legacyRowsFlagged: flagged },
      examples: examples.sort(),
      note: 'Self-proof on live values: the pre-CLM-020 "Status (N/100)" text fails the value check for every release row.',
    });
  }

  // 4. Sample: row presence, v2 keys, clocks, release, and rights-filtered API rows.
  {
    const examples: string[] = [];
    const bySlug = new Map<string, Set<string>>();
    for (const row of data.sampleRows) {
      const slug = text(row.slug);
      if (!bySlug.has(slug)) bySlug.set(slug, new Set());
      const sourceId = nullableText(row.source_id);
      if (sourceId) bySlug.get(slug)!.add(sourceId);
    }
    const releaseBySlugSource = new Map(
      data.releaseRows.map((row) => [`${text(row.slug)}:${text(row.source_id)}`, row]),
    );
    let rowsChecked = 0;
    let apiWithheld = 0;
    for (const slug of PUBLISHER_ATTRIBUTION_LIVE_SAMPLE) {
      const sources = bySlug.get(slug);
      if (!sources) {
        examples.push(`${slug}: not found`);
        continue;
      }
      const rows: ScoreRow[] = [];
      const vdem = releaseBySlugSource.get(`${slug}:vdem`);
      const fh = releaseBySlugSource.get(`${slug}:freedom_house`);
      if (vdem) rows.push(shapeVdemScoreRow(num(vdem.raw_value)!));
      if (fh) rows.push(shapeFreedomHouseScoreRow(num(fh.raw_value)!));
      if (Boolean(vdem) !== sources.has("vdem")) examples.push(`${slug}: V-Dem presence differs from the release`);
      if (slug === "monaco" && (vdem || !sources.has("worldbank_wgi"))) {
        examples.push("monaco: expected the WGI fallback and no V-Dem row");
      }
      for (const row of rows) {
        rowsChecked += 1;
        const keys = Object.keys(row).sort();
        if (keys.join() !== V2_KEYS.join()) examples.push(`${slug}/${row.id}: keys ${keys.join(",")}`);
        const input = RELEASE_PUBLISHER_INPUTS[row.source];
        if (
          row.publisherEdition !== input.publisherEdition ||
          row.observationPeriod !== input.observationPeriod ||
          row.retrievedAt !== input.retrievedAt ||
          row.release.releaseId !== CURRENT_CI_RELEASE_ID
        ) {
          examples.push(`${slug}/${row.id}: clocks differ from the release input manifest`);
        }
      }
      const api = shapePublicCountryScores(slug, rows, governanceEvidenceRights);
      apiWithheld += api.rows.filter((row) => row.valueStatus === "withheld").length;
    }
    checks.push({
      id: "country-scores.sample-contract",
      status: examples.length === 0 ? "pass" : "fail",
      counts: {
        sampleCountries: PUBLISHER_ATTRIBUTION_LIVE_SAMPLE.length,
        rowsChecked,
        apiRowsWithheldForRights: apiWithheld,
      },
      examples,
      note: "Rows appear exactly where the frozen release holds them (Monaco keeps its WGI fallback and has no V-Dem row), carry only the v2 keys and the manifest clocks, and the public API withholds values whose publisher terms do not permit export.",
    });
  }

  // 5. Conditions: every scored position is a registered, replayable Civica calculation.
  const componentsByKey = new Map<string, ConditionsPublicComponent[]>();
  for (const row of data.componentRows) {
    const key = text(row.calculation_key);
    const component: ConditionsPublicComponent = {
      componentId: text(row.component_id),
      nativeValue: num(row.native_value),
      nativeUnit: text(row.native_unit),
      referenceYear: num(row.reference_year),
      valueStatus: text(row.value_status),
      valueStatusReason: nullableText(row.value_status_reason),
      inclusionDecision: text(row.inclusion_decision),
      sourceId: text(row.source_id),
      sourceName: nullableText(row.source_name),
      indicatorId: text(row.indicator_id),
      upstreamRelease: text(row.upstream_release),
      licenseUrl: text(row.license_url),
      transformationId: text(row.transformation_id),
    };
    componentsByKey.set(key, [...(componentsByKey.get(key) ?? []), component]);
  }
  const stored: ConditionsStoredCalculation[] = data.calculationRows.map((row) => ({
    releaseId: text(row.release_id),
    jurisdictionId: text(row.jurisdiction_id),
    countryName: text(row.country_name),
    countrySlug: text(row.country_slug),
    countryIso3: nullableText(row.country_iso3),
    dimension: text(row.dimension) as ConditionsStoredCalculation["dimension"],
    calculationKey: text(row.calculation_key),
    alignmentPolicy: text(row.alignment_policy),
    alignmentStatus: text(row.alignment_status) as ConditionsStoredCalculation["alignmentStatus"],
    referenceYear: num(row.reference_year),
    normalizedScore: num(row.normalized_score),
    rawValue: num(row.raw_value),
    scoreTransformationId: nullableText(row.score_transformation_id),
    scoreSourceId: nullableText(row.score_source_id),
    scoreSourceName: nullableText(row.score_source_name),
    scoreIndicatorId: nullableText(row.score_indicator_id),
    scoreUpstreamRelease: nullableText(row.score_upstream_release),
    scoreLicenseUrl: nullableText(row.score_license_url),
    components: componentsByKey.get(text(row.calculation_key)) ?? [],
  }));
  const conditionsRelease = buildConditionsPublicRelease({
    release: data.conditionsHeader,
    calculations: stored,
  });
  shapeConditionsReleaseResponse(conditionsRelease);
  {
    const examples: string[] = [];
    let scored = 0;
    let failed = 0;
    for (const calculation of conditionsRelease.calculations) {
      if (calculation.normalizedScore === null) continue;
      scored += 1;
      const errors: string[] = [];
      const origin = calculation.scoreOrigin;
      const disclosure = origin ? civicaCalculationDisclosure(origin.transformationId) : null;
      if (!origin || !disclosure) errors.push("no registered scoreOrigin");
      if (calculation.components.length !== 1 || calculation.components[0].nativeValue !== calculation.rawValue) {
        errors.push("rawValue is not the single component's publisher value");
      }
      if (origin && disclosure && calculation.rawValue !== null) {
        errors.push(
          ...publisherAttributionErrors({
            surfaceId: "conditions.position.country",
            valueText: `${formatPosition(calculation.normalizedScore)} / 100`,
            origin,
            publisherFigures: [],
            markerRendered: true,
            calculationInput: calculation.rawValue,
          }),
        );
        if (Math.abs(fixedBoundPosition(disclosure, calculation.rawValue) - calculation.normalizedScore) > 1e-6) {
          errors.push("position does not replay from the component");
        }
      }
      if (errors.length > 0) {
        failed += 1;
        if (examples.length < 5) examples.push(`${calculation.countrySlug}/${calculation.dimension}: ${errors.join("; ")}`);
      }
    }
    checks.push({
      id: "conditions.position.contract",
      status: failed === 0 && scored > 0 ? "pass" : "fail",
      counts: { calculations: conditionsRelease.calculations.length, scoredPositions: scored, failed },
      examples,
      note: "The live release parses under the strict API contract; every scored position carries a registered scoreOrigin, equals the fixed-bound map of its single component, and passes the value check as rendered with its marker.",
    });
  }

  // 6. Human Development reference years against the same retained series.
  {
    const series = new Map<string, number>();
    for (const row of data.hdiSeriesRows) series.set(`${text(row.slug)}:${text(row.quarter)}`, num(row.raw_value)!);
    const history = new Map<string, number>();
    for (const row of data.hdiHistoryRows) history.set(`${text(row.slug)}:${num(row.year)}`, num(row.value)!);
    let components = 0;
    let withPriorYear = 0;
    let duplicates = 0;
    let historyCompared = 0;
    let historyDiffers = 0;
    const examples: string[] = [];
    const historyExamples: string[] = [];
    for (const calculation of conditionsRelease.calculations) {
      for (const component of calculation.components) {
        if (component.componentId !== "hdi" || component.nativeValue === null || component.referenceYear === null) continue;
        components += 1;
        const prior = series.get(`${calculation.countrySlug}:${component.referenceYear - 1}-Q4`);
        if (prior !== undefined) {
          withPriorYear += 1;
          if (Math.abs(prior - component.nativeValue) < 0.0005) {
            duplicates += 1;
            if (["india", "japan", "united-states"].includes(calculation.countrySlug)) {
              examples.push(
                `${calculation.countrySlug}: labelled ${component.referenceYear} = ${component.nativeValue}; the same series' ${component.referenceYear - 1} value is ${prior}`,
              );
            }
          }
        }
        const later = history.get(`${calculation.countrySlug}:${component.referenceYear}`);
        if (later !== undefined) {
          historyCompared += 1;
          if (Math.abs(later - component.nativeValue) >= 0.0005) {
            historyDiffers += 1;
            if (["india", "japan", "united-states"].includes(calculation.countrySlug)) {
              historyExamples.push(
                `${calculation.countrySlug}: release ${component.nativeValue} for ${component.referenceYear}; indicator_history ${later}`,
              );
            }
          }
        }
      }
    }
    const mislabelled = withPriorYear > 0 && duplicates / withPriorYear >= 0.9;
    checks.push({
      id: "conditions.hdi-year-duplicates-prior-year",
      status: mislabelled ? "fail" : "pass",
      scope: { releaseId: data.conditionsHeader.releaseId, componentId: "hdi" },
      counts: { hdiComponents: components, withPriorYearInSameSeries: withPriorYear, equalToPriorYear: duplicates },
      examples: examples.sort(),
      note: "A Human Development value labelled year Y that equals the same retained series' value for Y−1 in at least 90% of countries is a year label on the prior year's figures. This comparison does not depend on which Human Development Report edition the owner adopts.",
    });
    checks.push({
      id: "conditions.hdi-later-series-comparison",
      status: "unverified",
      counts: { compared: historyCompared, differ: historyDiffers },
      examples: historyExamples.sort(),
      note: "Informational. indicator_history holds a different, unnamed UNDP series (the CLM-020 review reports it as Human Development Report 2025 figures); an edition mismatch makes this comparison unable to decide which value is right.",
    });
    checks.push({
      id: "conditions.gpi-and-economic-components",
      status: "unverified",
      counts: {},
      examples: [],
      note: "No second retained copy of the Global Peace Index or the World Bank economic inputs exists (the GPI edition is operator-supplied; the World Bank inputs exist only as a capture hash).",
    });
  }

  // Heuristic record of the original defect (informational, never pass/fail).
  const signatures = {
    freedomHouseReleasePositionAt100: scaleEndClusterSignature(
      fhRows.map((row) => num(row.normalized_score)!),
      { min: 0, max: 100 },
    ),
    freedomHouseOwnTotalScoreAt100: scaleEndClusterSignature(
      data.fhTotalRows.map((row) => num(row.value)!),
      { min: 0, max: 100 },
    ),
    vdemDisplayedValues: scaleEndClusterSignature(
      vdemRows.map((row) => shapeVdemScoreRow(num(row.raw_value)!).score!),
      { min: 0, max: 1 },
    ),
  };

  // Exit: every failure must match a registered exception, and each exception a failure.
  const failures = checks.filter((check) => check.status === "fail");
  const matchedExceptions = LIVE_CHECK_EXCEPTIONS.filter((exception) =>
    failures.some(
      (check) =>
        check.id === exception.check &&
        check.scope?.releaseId === exception.scope.releaseId &&
        check.scope?.componentId === exception.scope.componentId,
    ),
  );
  const unregisteredFailures = failures.filter(
    (check) =>
      !LIVE_CHECK_EXCEPTIONS.some(
        (exception) =>
          exception.check === check.id &&
          check.scope?.releaseId === exception.scope.releaseId &&
          check.scope?.componentId === exception.scope.componentId,
      ),
  );
  const staleExceptions = LIVE_CHECK_EXCEPTIONS.filter(
    (exception) => !matchedExceptions.includes(exception),
  );

  const report = {
    schemaVersion: "publisher-attribution-live/v1",
    checkedAt: data.checkedAt,
    transaction: "READ ONLY, REPEATABLE READ",
    ciRelease: CURRENT_CI_RELEASE_ID,
    k1PanelRelease: K1_PANEL_RELEASE,
    conditionsRelease: data.conditionsHeader.releaseId,
    sample: PUBLISHER_ATTRIBUTION_LIVE_SAMPLE,
    checks: checks.map((check) => ({
      ...check,
      status:
        check.status === "fail" && !unregisteredFailures.includes(check)
          ? "registered_exception"
          : check.status,
    })),
    registeredExceptionsMatched: matchedExceptions.map((exception) => ({
      id: exception.id,
      followUp: exception.followUp,
      reason: exception.reason,
    })),
    staleExceptions: staleExceptions.map((exception) => exception.id),
    unregisteredFailures: unregisteredFailures.map((check) => check.id),
    heuristicSignatures: signatures,
  };

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (writeArgument) {
    writeFileSync(writeArgument.slice("--write=".length), serialized);
    console.log(`Wrote ${writeArgument.slice("--write=".length)}.`);
  }
  for (const check of report.checks) {
    console.log(`${check.status.toUpperCase().padEnd(20)} ${check.id} ${JSON.stringify(check.counts)}`);
    for (const example of check.examples) console.log(`    ${example}`);
  }
  if (unregisteredFailures.length > 0 || staleExceptions.length > 0) {
    console.error(
      `FAILED — unregistered failures: ${unregisteredFailures.map((check) => check.id).join(", ") || "none"}; stale exceptions: ${staleExceptions.map((exception) => exception.id).join(", ") || "none"}`,
    );
    process.exit(1);
  }
  console.log(
    `PASS — publisher-attribution live: ${checks.length} checks, ${matchedExceptions.length} registered exception matched (${matchedExceptions.map((exception) => `${exception.id} → ${exception.followUp}`).join(", ")}).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
