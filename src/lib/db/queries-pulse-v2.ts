/**
 * Phase 5.6 — Pulse v2 query helpers.
 *
 * Reads the dimensional-delta + classified-event tables seeded in
 * Phase 5.5. All queries return shapes appropriate for both API
 * endpoints and server-component consumers.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jurisdictions,
  pulseDimensionalDeltas,
  pulseEventsV2,
  pulseSources,
} from "@/lib/db/schema";
import { PULSE_DIMENSIONS, type PulseDimension } from "@/lib/pulse/v2/types";
import { pressFreedomScore } from "@/lib/pulse/v2/press-freedom";

/** A row in the per-country dimensional-delta panel. */
export interface DimensionRow {
  dimension: PulseDimension;
  delta: number;
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
}

export interface PulseV2ForCountry {
  jurisdiction: { id: string; slug: string; name: string; iso3: string | null };
  dimensions: Record<PulseDimension, DimensionRow>;
  lastComputedAt: string | null;
  /** Total published events feeding the deltas. */
  totalEvents: number;
  /** RSF Press Freedom score at the time of fetch — surfaces the
   *  closed-regime caveat on the country panel when score < 30. */
  pressFreedomScore: number;
}

/**
 * Pull the current dimensional deltas for a country, plus the top
 * driving events per dimension. Returns null when the country isn't
 * found. When the country exists but has no v2 data yet, returns
 * a zero-filled deltas object so callers can render a "no signal yet"
 * state without an extra null check.
 */
export async function getPulseV2ForCountry(
  slug: string
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

  // Pull all 5 dimension rows (or however many exist). Missing
  // dimensions get a zero default below.
  const deltaRows = await db
    .select()
    .from(pulseDimensionalDeltas)
    .where(eq(pulseDimensionalDeltas.jurisdictionId, jurisdiction.id));

  // Pull driving events per dimension — published rows in the
  // trailing 365d, sorted by absolute severity desc.
  const eventRows = await db
    .select({
      id: pulseEventsV2.id,
      dimension: pulseEventsV2.dimension,
      headline: pulseEventsV2.headline,
      eventDate: pulseEventsV2.eventDate,
      severityTier: pulseEventsV2.severityTier,
      severityValue: pulseEventsV2.severityValue,
    })
    .from(pulseEventsV2)
    .where(
      and(
        eq(pulseEventsV2.jurisdictionId, jurisdiction.id),
        eq(pulseEventsV2.published, true)
      )
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
    dimensions[dim] = {
      dimension: dim,
      delta: deltaRow?.deltaValue ?? 0,
      contributingEventIds: deltaRow?.contributingEventIds ?? [],
      drivingEvents: driving,
    };
  }

  return {
    jurisdiction,
    dimensions,
    lastComputedAt,
    totalEvents: eventRows.length,
    pressFreedomScore: press,
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
      published: pulseEventsV2.published,
      reviewStatus: pulseEventsV2.reviewStatus,
      headline: pulseEventsV2.headline,
      description: pulseEventsV2.description,
    })
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.jurisdictionId, jurisdiction.id))
    .orderBy(desc(pulseEventsV2.eventDate));

  const eventIds = events.map((e) => e.id);
  const sourceMap = new Map<
    string,
    Array<{
      sourceId: string;
      sourceType: string;
      sourceName: string;
      sourceUrl: string | null;
    }>
  >();
  if (eventIds.length) {
    const sourceRows = await db
      .select({
        eventId: pulseSources.eventId,
        sourceId: pulseSources.sourceId,
        sourceType: pulseSources.sourceType,
        sourceName: pulseSources.sourceName,
        sourceUrl: pulseSources.sourceUrl,
      })
      .from(pulseSources)
      .where(sql`${pulseSources.eventId} IN ${eventIds}`);
    for (const row of sourceRows) {
      const arr = sourceMap.get(row.eventId) ?? [];
      arr.push({
        sourceId: row.sourceId,
        sourceType: row.sourceType,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
      });
      sourceMap.set(row.eventId, arr);
    }
  }

  return {
    jurisdiction,
    events: events.map((e) => ({
      ...e,
      sources: sourceMap.get(e.id) ?? [],
    })),
  };
}

export interface PulseV2ChangelogFilters {
  country?: string;
  dimension?: PulseDimension;
  severityTier?: string;
  sinceDate?: string;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface PulseV2ClassifierRun {
  run: number;
  temp: number;
  model?: string;
  category: string;
  dimension: string;
  severityTier: string;
  severityValue: number;
  rationale: string;
}

export interface PulseV2SourceDetail {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string | null;
}

export interface PulseV2ChangelogRow {
  id: string;
  eventDate: string;
  country: { slug: string; name: string };
  category: string;
  dimension: string;
  severityTier: string;
  severityValue: number;
  classifierAgreement: string;
  classifierRuns: PulseV2ClassifierRun[];
  corroborationConfidence: number;
  pressFreedomScoreAtClassification: number | null;
  published: boolean;
  reviewStatus: string;
  headline: string;
  description: string;
  aiSummary: string | null;
  /** Distinct source ids (compat with existing callers). */
  sources: string[];
  /** Full source attribution rows (name, type, url). */
  sourceDetail: PulseV2SourceDetail[];
}

/** Paginated global changelog. Optional filters narrow the feed. */
export async function getPulseV2Changelog(
  filters: PulseV2ChangelogFilters = {}
): Promise<{ rows: PulseV2ChangelogRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 2500);
  const offset = Math.max(filters.offset ?? 0, 0);

  // Build a SQL WHERE list
  const wheres: ReturnType<typeof sql>[] = [];
  if (filters.country) {
    wheres.push(sql`LOWER(j.slug) = ${filters.country.toLowerCase()}`);
  }
  if (filters.dimension) {
    wheres.push(sql`p.dimension = ${filters.dimension}`);
  }
  if (filters.severityTier) {
    wheres.push(sql`p.severity_tier = ${filters.severityTier}`);
  }
  if (filters.sinceDate) {
    wheres.push(sql`p.event_date >= ${filters.sinceDate}`);
  }
  if (filters.publishedOnly) {
    wheres.push(sql`p.published = true`);
  }

  const whereClause =
    wheres.length === 0
      ? sql`TRUE`
      : sql.join(wheres, sql` AND `);

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
      p.published,
      p.review_status,
      p.headline,
      p.description,
      p.ai_summary,
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
            'sourceUrl', ps.source_url
          ) ORDER BY ps.source_type, ps.source_name
        ) FROM pulse_sources ps WHERE ps.event_id = p.id),
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

  const rows: PulseV2ChangelogRow[] = trimmed.map((r) => {
    const rawRuns = r.classifier_runs;
    const runs: PulseV2ClassifierRun[] = Array.isArray(rawRuns)
      ? (rawRuns as Array<Record<string, unknown>>).map((rr) => ({
          run: Number(rr.run ?? 0),
          temp: Number(rr.temp ?? 0),
          model: rr.model ? String(rr.model) : undefined,
          category: String(rr.category ?? ""),
          dimension: String(rr.dimension ?? ""),
          severityTier: String(rr.severityTier ?? rr.severity_tier ?? ""),
          severityValue: Number(rr.severityValue ?? rr.severity_value ?? 0),
          rationale: String(rr.rationale ?? ""),
        }))
      : [];

    const rawDetail = r.source_detail;
    const sourceDetail: PulseV2SourceDetail[] = Array.isArray(rawDetail)
      ? (rawDetail as Array<Record<string, unknown>>).map((s) => ({
          sourceId: String(s.sourceId ?? s.source_id ?? ""),
          sourceName: String(s.sourceName ?? s.source_name ?? ""),
          sourceType: String(s.sourceType ?? s.source_type ?? ""),
          sourceUrl: s.sourceUrl
            ? String(s.sourceUrl)
            : s.source_url
              ? String(s.source_url)
              : null,
        }))
      : [];

    const rsfRaw = r.press_freedom_score_at_classification;
    const pressFreedomScoreAtClassification =
      rsfRaw === null || rsfRaw === undefined ? null : Number(rsfRaw);

    return {
      id: String(r.id),
      eventDate: String(r.event_date),
      country: {
        slug: String(r.country_slug),
        name: String(r.country_name),
      },
      category: String(r.category),
      dimension: String(r.dimension),
      severityTier: String(r.severity_tier),
      severityValue: Number(r.severity_value),
      classifierAgreement: String(r.classifier_agreement),
      classifierRuns: runs,
      corroborationConfidence: Number(r.corroboration_confidence),
      pressFreedomScoreAtClassification,
      published: Boolean(r.published),
      reviewStatus: String(r.review_status),
      headline: String(r.headline),
      description: String(r.description),
      aiSummary: r.ai_summary ? String(r.ai_summary) : null,
      sources: Array.isArray(r.source_ids) ? (r.source_ids as string[]) : [],
      sourceDetail,
    };
  });

  return { rows, hasMore };
}
