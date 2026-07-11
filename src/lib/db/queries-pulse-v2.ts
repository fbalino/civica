/**
 * Phase 5.6 — Pulse v2 query helpers.
 *
 * Reads the dimensional-delta + classified-event tables seeded in
 * Phase 5.5. All queries return shapes appropriate for both API
 * endpoints and server-component consumers.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jurisdictions,
  pulseDimensionalDeltas,
  pulseEventsV2,
  pulsePipelineRuns,
  rawEvents,
  pulseSources,
} from "@/lib/db/schema";
import { PULSE_DIMENSIONS, type PulseDimension } from "@/lib/pulse/v2/types";
import { SCORE_WINDOW_DAYS } from "@/lib/pulse/v2/taxonomy";
import {
  pressFreedomScore,
  RSF_SCORES_2024,
} from "@/lib/pulse/v2/press-freedom";
import {
  publicationOriginFor,
  type PulsePublicationOrigin,
} from "@/lib/pulse/v2/review-validation";
import {
  summarizePulseVersionSet,
  type PulseStageVersionEnvelope,
  type PulseVersionSetSummary,
} from "@/lib/pulse/v2/pipeline-version";
import type {
  PulseEvidenceAttributionSnapshot,
  PulseEvidencePublisherSnapshot,
  PulseEvidenceRetentionSnapshot,
  PulseEvidenceRightsSnapshot,
} from "@/lib/pulse/v2/evidence-identity";

export interface PulseRunIdentity {
  runId: string;
  versionKey: string;
  versions: PulseStageVersionEnvelope;
}

function pulseTimestampIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? "");
  const parsed = new Date(
    /[zZ]|[+-]\d\d(?::?\d\d)?$/.test(text) ? text : `${text}Z`,
  );
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

async function loadPulseRunMap(runIds: readonly string[]) {
  const ids = [...new Set(runIds.filter(Boolean))];
  const rows = ids.length
    ? await db
        .select({
          id: pulsePipelineRuns.id,
          versionKey: pulsePipelineRuns.versionKey,
          versions: pulsePipelineRuns.versions,
        })
        .from(pulsePipelineRuns)
        .where(inArray(pulsePipelineRuns.id, ids))
    : [];
  return new Map(
    rows.map((row) => [
      row.id,
      { runId: row.id, versionKey: row.versionKey, versions: row.versions },
    ]),
  );
}

/** A row in the per-country dimensional-delta panel. */
export interface DimensionRow {
  dimension: PulseDimension;
  /** Null when no eligible published event supports this dimension now. */
  delta: number | null;
  contributingEventIds: string[];
  /** 0–2 driving event headlines for the panel, sorted by absolute decayed impact. */
  drivingEvents: Array<{
    id: string;
    headline: string;
    eventDate: string;
    severityTier: string;
    severityValue: number;
    sources: string[];
  }>;
  /**
   * Evidence basis for judging whether this delta rests on thin ground.
   * Computed across the dimension's contributing PUBLISHED events.
   */
  evidence: {
    /** Number of contributing published events behind this delta. */
    nEvents: number;
    /** Highest corroboration confidence ([0,1]) among contributing events. */
    maxConfidence: number;
    /** Fewest distinct sources on any single contributing event. */
    minSources: number;
    /** Most distinct sources on any single contributing event. */
    maxSources: number;
    /** Every contributing event is backed by a single source. */
    allSingleSource: boolean;
  };
  /**
   * True when the delta rests on thin evidence and should read as a
   * provisional "limited signal" rather than an authoritative score:
   * one event, all single-source, or low max confidence.
   */
  limitedSignal: boolean;
  /**
   * Most accurate qualifier for the thinness trigger, or null when the
   * basis is adequate. "Single source" | "Single event" | "Low confidence".
   */
  limitedReason: string | null;
  /** Exact immutable score-stage run behind this stored output. */
  versionIdentity: PulseRunIdentity | null;
}

export interface PulseV2ForCountry {
  jurisdiction: { id: string; slug: string; name: string; iso3: string | null };
  dimensions: Record<PulseDimension, DimensionRow>;
  lastComputedAt: string | null;
  /** Total published events feeding the deltas. */
  totalEvents: number;
  /** Provisional context heuristic used by the current weighting code.
   * This is not a complete or live RSF dataset. */
  pressFreedomContext: {
    score: number;
    source: "approximate_static_2024_subset";
    directLookup: boolean;
    defaultApplied: boolean;
  };
  versionSet: PulseVersionSetSummary;
}

/**
 * Pull the current dimensional deltas for a country, plus the top
 * driving events per dimension. Returns null when the country isn't
 * found. When the country exists but has no eligible v2 event for a dimension,
 * returns `delta: null` so callers render non-observation rather than zero.
 */
export async function getPulseV2ForCountry(
  slug: string,
): Promise<PulseV2ForCountry | null> {
  const lower = slug.toLowerCase();

  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(sql`LOWER(${jurisdictions.slug}) = ${lower}`)
    .limit(1);

  const jurisdiction = jurisdictionRows[0];
  if (!jurisdiction) return null;
  const press = pressFreedomScore(jurisdiction.iso3);
  const directPressLookup = Boolean(
    jurisdiction.iso3 &&
    RSF_SCORES_2024[jurisdiction.iso3.toUpperCase()] != null,
  );

  // Pull all stored dimension rows. Missing or not-yet-computed dimensions
  // remain unobserved (`delta: null`) below.
  const deltaRows = await db
    .select()
    .from(pulseDimensionalDeltas)
    .where(eq(pulseDimensionalDeltas.jurisdictionId, jurisdiction.id));
  const computationRuns = await loadPulseRunMap(
    deltaRows.map(({ computationRunId }) => computationRunId),
  );

  // Pull driving events per dimension — only the same trailing 365-day
  // window used by the scoring pipeline. Older published rows remain in the
  // ledger but must not inflate the country panel's event count or evidence.
  const eventRows = await db
    .select({
      id: pulseEventsV2.id,
      dimension: pulseEventsV2.dimension,
      headline: pulseEventsV2.headline,
      eventDate: pulseEventsV2.eventDate,
      severityTier: pulseEventsV2.severityTier,
      severityValue: pulseEventsV2.severityValue,
      corroborationConfidence: pulseEventsV2.corroborationConfidence,
    })
    .from(pulseEventsV2)
    .where(
      and(
        eq(pulseEventsV2.jurisdictionId, jurisdiction.id),
        eq(pulseEventsV2.published, true),
        sql`${pulseEventsV2.reviewStatus} IN ('approved', 'edited')`,
        sql`${pulseEventsV2.category} <> 'none'`,
        sql`${pulseEventsV2.eventDate} >= CURRENT_DATE - (${SCORE_WINDOW_DAYS} * INTERVAL '1 day')`,
        sql`${pulseEventsV2.eventDate} <= CURRENT_DATE`,
      ),
    )
    .orderBy(desc(sql`ABS(${pulseEventsV2.severityValue})`));

  // Source map for quick attribution lookup
  const eventIds = eventRows.map((e) => e.id);
  const sourceMap = new Map<string, string[]>();
  if (eventIds.length) {
    const sourceRows = await db
      .select({
        eventId: pulseSources.eventId,
        sourceId: pulseSources.sourceId,
      })
      .from(pulseSources)
      .where(sql`${pulseSources.eventId} IN ${eventIds}`);
    for (const row of sourceRows) {
      const arr = sourceMap.get(row.eventId) ?? [];
      arr.push(row.sourceId);
      sourceMap.set(row.eventId, arr);
    }
  }

  // Per-event lookups for evidence-basis (thinness) computation. Both
  // maps are keyed only by PUBLISHED events — the rows that actually
  // drive the score and that the panel can show.
  const confidenceByEvent = new Map<string, number>();
  const sourceCountByEvent = new Map<string, number>();
  for (const e of eventRows) {
    confidenceByEvent.set(e.id, e.corroborationConfidence ?? 0);
    sourceCountByEvent.set(e.id, new Set(sourceMap.get(e.id) ?? []).size);
  }

  // Build the dimensions object — zero-fill any missing dimension
  const dimensions = {} as Record<PulseDimension, DimensionRow>;
  let lastComputedAt: string | null = null;
  for (const dim of PULSE_DIMENSIONS) {
    const deltaRow = deltaRows.find((r) => r.dimension === dim);
    if (deltaRow?.lastComputedAt) {
      const stamp = deltaRow.lastComputedAt.toISOString();
      if (!lastComputedAt || stamp > lastComputedAt) lastComputedAt = stamp;
    }
    const driving = eventRows
      .filter((e) => e.dimension === dim)
      .slice(0, 2)
      .map((e) => ({
        id: e.id,
        headline: e.headline,
        eventDate: e.eventDate,
        severityTier: e.severityTier,
        severityValue: e.severityValue,
        sources: Array.from(new Set(sourceMap.get(e.id) ?? [])),
      }));

    // Evidence basis: judge thinness across the dimension's contributing
    // PUBLISHED events. We intersect the delta's contributing-event ids
    // with the published set so unpublished/queued events never inflate
    // (or deflate) the basis.
    const contributingIds = deltaRow?.contributingEventIds ?? [];
    const publishedContributing = contributingIds.filter((id) =>
      sourceCountByEvent.has(id),
    );
    const nEvents = publishedContributing.length;
    const confidences = publishedContributing.map(
      (id) => confidenceByEvent.get(id) ?? 0,
    );
    const sourceCounts = publishedContributing.map(
      (id) => sourceCountByEvent.get(id) ?? 0,
    );
    const maxConfidence = confidences.length ? Math.max(...confidences) : 0;
    const minSources = sourceCounts.length ? Math.min(...sourceCounts) : 0;
    const maxSources = sourceCounts.length ? Math.max(...sourceCounts) : 0;
    const allSingleSource = nEvents > 0 && maxSources <= 1;

    // Thinness triggers (per the methodology hedge): a single contributing
    // event, every event single-sourced, or low max confidence. Only a
    // delta that actually moved (|δ| ≥ 0.5) can read as a "limited" signal;
    // a flat dimension has its own treatment and needs no qualifier.
    const moved = nEvents > 0 && Math.abs(deltaRow?.deltaValue ?? 0) >= 0.5;
    const limitedSignal =
      moved &&
      nEvents > 0 &&
      (nEvents <= 1 || allSingleSource || maxConfidence < 0.4);

    // Pick the most accurate single qualifier for the trigger that fired.
    let limitedReason: string | null = null;
    if (limitedSignal) {
      if (nEvents <= 1) limitedReason = "Single event";
      else if (allSingleSource) limitedReason = "Single source";
      else limitedReason = "Low confidence";
    }

    dimensions[dim] = {
      dimension: dim,
      delta: nEvents > 0 && deltaRow ? deltaRow.deltaValue : null,
      contributingEventIds: contributingIds,
      drivingEvents: driving,
      evidence: {
        nEvents,
        maxConfidence,
        minSources,
        maxSources,
        allSingleSource,
      },
      limitedSignal,
      limitedReason,
      versionIdentity: deltaRow
        ? (computationRuns.get(deltaRow.computationRunId) ?? null)
        : null,
    };
  }

  return {
    jurisdiction,
    dimensions,
    lastComputedAt,
    totalEvents: eventRows.length,
    pressFreedomContext: {
      score: press,
      source: "approximate_static_2024_subset",
      directLookup: directPressLookup,
      defaultApplied: !directPressLookup,
    },
    versionSet: summarizePulseVersionSet(
      [...computationRuns.values()].map(({ versionKey, versions }) => ({
        versionKey,
        versions,
      })),
    ),
  };
}

/** Full event list for a country, with sources joined. */
export async function getPulseV2EventsForCountry(slug: string) {
  const lower = slug.toLowerCase();

  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
    })
    .from(jurisdictions)
    .where(sql`LOWER(${jurisdictions.slug}) = ${lower}`)
    .limit(1);

  const jurisdiction = jurisdictionRows[0];
  if (!jurisdiction) return null;

  const events = await db
    .select({
      id: pulseEventsV2.id,
      eventDate: pulseEventsV2.eventDate,
      category: pulseEventsV2.category,
      dimension: pulseEventsV2.dimension,
      severityTier: pulseEventsV2.severityTier,
      severityValue: pulseEventsV2.severityValue,
      corroborationConfidence: pulseEventsV2.corroborationConfidence,
      classifierAgreement: pulseEventsV2.classifierAgreement,
      humanReviewed: pulseEventsV2.humanReviewed,
      published: pulseEventsV2.published,
      reviewStatus: pulseEventsV2.reviewStatus,
      headline: pulseEventsV2.headline,
      description: pulseEventsV2.description,
      classificationRunId: pulseEventsV2.classificationRunId,
      publicationRunId: pulseEventsV2.publicationRunId,
      corroborationRunId: pulseEventsV2.corroborationRunId,
    })
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.jurisdictionId, jurisdiction.id))
    .orderBy(desc(pulseEventsV2.eventDate));

  const eventIds = events.map((e) => e.id);
  const runMap = await loadPulseRunMap(
    events.flatMap((event) => [
      event.classificationRunId,
      event.publicationRunId ?? "",
      event.corroborationRunId ?? "",
    ]),
  );
  const sourceMap = new Map<
    string,
    Array<{
      sourceId: string;
      sourceType: string;
      sourceName: string;
      sourceUrl: string;
      evidenceIdentity: PulseEvidenceIdentityDetail;
    }>
  >();
  if (eventIds.length) {
    const sourceRows = await db
      .select({
        eventId: pulseSources.eventId,
        sourceId: pulseSources.sourceId,
        sourceType: pulseSources.sourceType,
        sourceName: pulseSources.sourceName,
        sourceUrl: rawEvents.sourceUrl,
        evidenceIdentityKey: rawEvents.evidenceIdentityKey,
        evidenceContentHash: rawEvents.evidenceContentHash,
        evidenceLanguage: rawEvents.evidenceLanguage,
        retrievedAt: rawEvents.retrievedAt,
        evidencePublisher: rawEvents.evidencePublisher,
        evidenceAttribution: rawEvents.evidenceAttribution,
        evidenceRights: rawEvents.evidenceRights,
        evidenceRetention: rawEvents.evidenceRetention,
      })
      .from(pulseSources)
      .innerJoin(rawEvents, eq(pulseSources.rawEventId, rawEvents.id))
      .where(sql`${pulseSources.eventId} IN ${eventIds}`);
    for (const row of sourceRows) {
      const arr = sourceMap.get(row.eventId) ?? [];
      arr.push({
        sourceId: row.sourceId,
        sourceType: row.sourceType,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        evidenceIdentity: {
          identityKey: row.evidenceIdentityKey,
          contentHash: row.evidenceContentHash,
          retrievedAt: row.retrievedAt.toISOString(),
          language: row.evidenceLanguage,
          publisher: row.evidencePublisher,
          attribution: row.evidenceAttribution,
          rights: row.evidenceRights,
          retention: row.evidenceRetention,
        },
      });
      sourceMap.set(row.eventId, arr);
    }
  }

  return {
    jurisdiction,
    events: events.map((e) => {
      const {
        classificationRunId,
        publicationRunId,
        corroborationRunId,
        ...publicEvent
      } = e;
      return {
        ...publicEvent,
        // A deadlocked ensemble is stored in the current non-null schema with
        // category="none" and a compatibility dimension. Do not expose that
        // placeholder as a substantive Stability classification.
        dimension: e.category === "none" ? null : e.dimension,
        severityTier: e.category === "none" ? null : e.severityTier,
        severityValue: e.category === "none" ? null : e.severityValue,
        publicationOrigin: publicationOriginFor(e),
        versionIdentity: {
          classification: runMap.get(classificationRunId) ?? null,
          publication: publicationRunId
            ? (runMap.get(publicationRunId) ?? null)
            : null,
          corroboration: corroborationRunId
            ? (runMap.get(corroborationRunId) ?? null)
            : null,
        },
        sources: sourceMap.get(e.id) ?? [],
      };
    }),
    versionSet: summarizePulseVersionSet(
      events
        .map(({ classificationRunId }) => runMap.get(classificationRunId))
        .filter((row): row is PulseRunIdentity => Boolean(row))
        .map(({ versionKey, versions }) => ({ versionKey, versions })),
    ),
  };
}

export interface PulseV2ChangelogFilters {
  country?: string;
  dimension?: PulseDimension;
  severityTier?: string;
  sinceDate?: string;
  /** Database-relative lookback, avoiding render-clock-derived dates. */
  withinDays?: number;
  /** Restrict to rows that can feed the current experimental-delta window. */
  deltaEligibleOnly?: boolean;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface PulseV2ClassifierRun {
  run: number;
  temp: number;
  model?: string;
  /** Vendor engine that produced the run (ensemble rows; absent on legacy). */
  provider?: string;
  category: string;
  dimension: string;
  severityTier: string;
  severityValue: number;
  /** Verify-pass verdict on the verify row (absent on classify/legacy rows). */
  confidence?: "high" | "medium" | "low";
  rationale: string;
}

export interface PulseV2SourceDetail {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  evidenceIdentity: PulseEvidenceIdentityDetail;
}

export interface PulseEvidenceIdentityDetail {
  identityKey: string;
  contentHash: string;
  retrievedAt: string;
  language: string;
  publisher: PulseEvidencePublisherSnapshot;
  attribution: PulseEvidenceAttributionSnapshot;
  rights: PulseEvidenceRightsSnapshot;
  retention: PulseEvidenceRetentionSnapshot;
}

export interface PulseV2ChangelogRow {
  id: string;
  eventDate: string;
  country: { slug: string; name: string };
  category: string;
  dimension: string;
  severityTier: string | null;
  severityValue: number | null;
  classifierAgreement: string;
  classifierRuns: PulseV2ClassifierRun[];
  corroborationConfidence: number;
  pressFreedomScoreAtClassification: number | null;
  humanReviewed: boolean;
  publicationOrigin: PulsePublicationOrigin;
  published: boolean;
  reviewStatus: string;
  headline: string;
  description: string;
  aiSummary: string | null;
  /** Distinct source ids (compat with existing callers). */
  sources: string[];
  /** Full source attribution rows (name, type, url). */
  sourceDetail: PulseV2SourceDetail[];
  versionIdentity: {
    classification: PulseRunIdentity | null;
    publication: PulseRunIdentity | null;
    corroboration: PulseRunIdentity | null;
  };
}

/** Paginated global changelog. Optional filters narrow the feed. */
export async function getPulseV2Changelog(
  filters: PulseV2ChangelogFilters = {},
): Promise<{
  rows: PulseV2ChangelogRow[];
  hasMore: boolean;
  versionSet: PulseVersionSetSummary;
}> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 2500);
  const offset = Math.max(filters.offset ?? 0, 0);

  // Build a SQL WHERE list
  const wheres: ReturnType<typeof sql>[] = [];
  if (filters.country) {
    wheres.push(sql`LOWER(j.slug) = ${filters.country.toLowerCase()}`);
  }
  if (filters.dimension) {
    wheres.push(
      sql`p.dimension = ${filters.dimension} AND p.category <> 'none'`,
    );
  }
  if (filters.severityTier) {
    wheres.push(
      sql`p.severity_tier = ${filters.severityTier} AND p.category <> 'none'`,
    );
  }
  if (filters.sinceDate) {
    wheres.push(sql`p.event_date >= ${filters.sinceDate}`);
  }
  if (filters.withinDays && filters.withinDays > 0) {
    const days = Math.min(Math.floor(filters.withinDays), 3650);
    wheres.push(
      sql`p.event_date >= CURRENT_DATE - (${days} * INTERVAL '1 day')`,
    );
    wheres.push(sql`p.event_date <= CURRENT_DATE`);
  }
  if (filters.deltaEligibleOnly) {
    wheres.push(sql`p.published = true`);
    wheres.push(sql`p.review_status IN ('approved', 'edited')`);
    wheres.push(sql`p.category <> 'none'`);
  }
  if (filters.publishedOnly) {
    wheres.push(sql`p.published = true`);
  }

  const whereClause =
    wheres.length === 0 ? sql`TRUE` : sql.join(wheres, sql` AND `);

  const rowsResult = await db.execute(sql`
    SELECT
      p.id,
      p.event_date,
      j.slug AS country_slug,
      j.name AS country_name,
      p.category,
      p.dimension,
      p.severity_tier,
      p.severity_value,
      p.classifier_agreement,
      p.classifier_runs,
      p.corroboration_confidence,
      p.press_freedom_score_at_classification,
      p.human_reviewed,
      p.published,
      p.review_status,
      p.headline,
      p.description,
      p.ai_summary,
      p.classification_run_id,
      p.publication_run_id,
      p.corroboration_run_id,
      ARRAY(
        SELECT DISTINCT ps.source_id
        FROM pulse_sources ps
        WHERE ps.event_id = p.id
      ) AS source_ids,
      COALESCE(
        (SELECT json_agg(
          json_build_object(
            'sourceId', ps.source_id,
            'sourceName', ps.source_name,
            'sourceType', ps.source_type,
            'sourceUrl', re.source_url,
            'evidenceIdentity', json_build_object(
              'identityKey', re.evidence_identity_key,
              'contentHash', re.evidence_content_hash,
              'retrievedAt', re.retrieved_at,
              'language', re.evidence_language,
              'publisher', re.evidence_publisher,
              'attribution', re.evidence_attribution,
              'rights', re.evidence_rights,
              'retention', re.evidence_retention
            )
          ) ORDER BY ps.source_type, ps.source_name
        ) FROM pulse_sources ps JOIN raw_events re ON re.id = ps.raw_event_id WHERE ps.event_id = p.id),
        '[]'::json
      ) AS source_detail
    FROM pulse_events_v2 p
    JOIN jurisdictions j ON j.id = p.jurisdiction_id
    WHERE ${whereClause}
    ORDER BY p.event_date DESC, p.created_at DESC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `);

  const raw = ((rowsResult as unknown as { rows?: unknown[] }).rows ??
    rowsResult) as Array<Record<string, unknown>>;

  const hasMore = raw.length > limit;
  const trimmed = hasMore ? raw.slice(0, limit) : raw;
  const runMap = await loadPulseRunMap(
    trimmed.flatMap((row) => [
      String(row.classification_run_id ?? ""),
      String(row.publication_run_id ?? ""),
      String(row.corroboration_run_id ?? ""),
    ]),
  );

  const rows: PulseV2ChangelogRow[] = trimmed.map((r) => {
    const rawRuns = r.classifier_runs;
    const runs: PulseV2ClassifierRun[] = Array.isArray(rawRuns)
      ? (rawRuns as Array<Record<string, unknown>>).map((rr) => ({
          run: Number(rr.run ?? 0),
          temp: Number(rr.temp ?? 0),
          model: rr.model ? String(rr.model) : undefined,
          provider: rr.provider ? String(rr.provider) : undefined,
          category: String(rr.category ?? ""),
          dimension: String(rr.dimension ?? ""),
          severityTier: String(rr.severityTier ?? rr.severity_tier ?? ""),
          severityValue: Number(rr.severityValue ?? rr.severity_value ?? 0),
          confidence:
            rr.confidence === "high" ||
            rr.confidence === "medium" ||
            rr.confidence === "low"
              ? rr.confidence
              : undefined,
          rationale: String(rr.rationale ?? ""),
        }))
      : [];

    const rawDetail = r.source_detail;
    const sourceDetail: PulseV2SourceDetail[] = Array.isArray(rawDetail)
      ? (rawDetail as Array<Record<string, unknown>>).map((s) => {
          const evidence = (s.evidenceIdentity ??
            s.evidence_identity ??
            {}) as Record<string, unknown>;
          return {
            sourceId: String(s.sourceId ?? s.source_id ?? ""),
            sourceName: String(s.sourceName ?? s.source_name ?? ""),
            sourceType: String(s.sourceType ?? s.source_type ?? ""),
            sourceUrl: String(s.sourceUrl ?? s.source_url ?? ""),
            evidenceIdentity: {
              identityKey: String(evidence.identityKey ?? ""),
              contentHash: String(evidence.contentHash ?? ""),
              retrievedAt: pulseTimestampIso(evidence.retrievedAt),
              language: String(evidence.language ?? "und"),
              publisher: evidence.publisher as PulseEvidencePublisherSnapshot,
              attribution:
                evidence.attribution as PulseEvidenceAttributionSnapshot,
              rights: evidence.rights as PulseEvidenceRightsSnapshot,
              retention: evidence.retention as PulseEvidenceRetentionSnapshot,
            },
          };
        })
      : [];

    const rsfRaw = r.press_freedom_score_at_classification;
    const pressFreedomScoreAtClassification =
      rsfRaw === null || rsfRaw === undefined ? null : Number(rsfRaw);

    const category = String(r.category);
    const published = Boolean(r.published);
    const humanReviewed = Boolean(r.human_reviewed);
    return {
      id: String(r.id),
      eventDate: String(r.event_date),
      country: {
        slug: String(r.country_slug),
        name: String(r.country_name),
      },
      category,
      dimension: category === "none" ? "unresolved" : String(r.dimension),
      severityTier: category === "none" ? null : String(r.severity_tier),
      severityValue: category === "none" ? null : Number(r.severity_value),
      classifierAgreement: String(r.classifier_agreement),
      classifierRuns: runs,
      corroborationConfidence: Number(r.corroboration_confidence),
      pressFreedomScoreAtClassification,
      humanReviewed,
      publicationOrigin: publicationOriginFor({
        published,
        humanReviewed,
        reviewStatus: String(r.review_status),
      }),
      published,
      reviewStatus: String(r.review_status),
      headline: String(r.headline),
      description: String(r.description),
      aiSummary: r.ai_summary ? String(r.ai_summary) : null,
      sources: Array.isArray(r.source_ids) ? (r.source_ids as string[]) : [],
      sourceDetail,
      versionIdentity: {
        classification:
          runMap.get(String(r.classification_run_id ?? "")) ?? null,
        publication: runMap.get(String(r.publication_run_id ?? "")) ?? null,
        corroboration: runMap.get(String(r.corroboration_run_id ?? "")) ?? null,
      },
    };
  });

  return {
    rows,
    hasMore,
    versionSet: summarizePulseVersionSet(
      [...runMap.values()]
        .filter(({ versions }) => versions.stage === "classify")
        .map(({ versionKey, versions }) => ({ versionKey, versions })),
    ),
  };
}
