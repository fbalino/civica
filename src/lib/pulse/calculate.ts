import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, sql as dsql, ne } from "drizzle-orm";
import {
  jurisdictions,
  pulseEvents,
  pulseDailyScores,
  pulseChangelog,
  ciCompositeScores,
  ciMethodologyVersions,
} from "../db/schema";

export function createDb() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sqlClient });
}

export type Db = ReturnType<typeof createDb>;

const HALF_LIFE_DAYS = 30;
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const WINDOW_DAYS = 120;

function decayedImpact(
  severity: number,
  confidence: number,
  daysSinceEvent: number
): number {
  return severity * confidence * Math.exp(-DECAY_LAMBDA * daysSinceEvent);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface PulseCalculationSummary {
  jurisdictionsProcessed: number;
  scoresWritten: number;
  eventsExpired: number;
}

async function getLatestMethodologyVersion(db: Db): Promise<string> {
  const rows = await db
    .select({ id: ciMethodologyVersions.id })
    .from(ciMethodologyVersions)
    .orderBy(dsql`${ciMethodologyVersions.publishedAt} DESC`)
    .limit(1);
  if (rows.length === 0) {
    throw new Error(
      "No methodology version found. Run seed-ci-methodology first."
    );
  }
  return rows[0].id;
}

export async function expireOldEvents(db: Db): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffDate = cutoff.toISOString().split("T")[0];

  const result = await db
    .update(pulseEvents)
    .set({ isActive: false })
    .where(
      and(
        eq(pulseEvents.isActive, true),
        dsql`${pulseEvents.eventDate} < ${cutoffDate}`
      )
    )
    .returning({ id: pulseEvents.id });

  return result.length;
}

interface ActiveEvent {
  id: string;
  eventDate: string;
  severity: number;
  confidence: number;
}

async function getActiveEvents(
  db: Db,
  jurisdictionId: string
): Promise<ActiveEvent[]> {
  return db
    .select({
      id: pulseEvents.id,
      eventDate: pulseEvents.eventDate,
      severity: pulseEvents.severity,
      confidence: pulseEvents.confidence,
    })
    .from(pulseEvents)
    .where(
      and(
        eq(pulseEvents.jurisdictionId, jurisdictionId),
        eq(pulseEvents.isActive, true),
        ne(pulseEvents.category, "unclassified")
      )
    );
}

async function getCiBaseline(
  db: Db,
  jurisdictionId: string
): Promise<number | null> {
  const rows = await db
    .select({ score: ciCompositeScores.score })
    .from(ciCompositeScores)
    .where(eq(ciCompositeScores.jurisdictionId, jurisdictionId))
    .orderBy(dsql`${ciCompositeScores.calculatedAt} DESC`)
    .limit(1);
  return rows.length > 0 ? rows[0].score : null;
}

export async function calculatePulseScores(
  db: Db,
  targetIso3?: string
): Promise<PulseCalculationSummary> {
  const methodologyVersion = await getLatestMethodologyVersion(db);
  const today = new Date().toISOString().split("T")[0];

  const expired = await expireOldEvents(db);
  console.log(`[pulse] Expired ${expired} events older than ${WINDOW_DAYS} days.`);

  let jurisdictionRows;
  if (targetIso3) {
    jurisdictionRows = await db
      .select({ id: jurisdictions.id, iso3: jurisdictions.iso3 })
      .from(jurisdictions)
      .where(eq(jurisdictions.iso3, targetIso3.toUpperCase()));
  } else {
    jurisdictionRows = await db
      .select({ id: jurisdictions.id, iso3: jurisdictions.iso3 })
      .from(jurisdictions)
      .where(dsql`${jurisdictions.iso3} IS NOT NULL`);
  }

  let scoresWritten = 0;

  for (const jurisdiction of jurisdictionRows) {
    const events = await getActiveEvents(db, jurisdiction.id);
    if (events.length === 0) continue;

    const todayMs = new Date(today).getTime();
    let totalImpact = 0;
    let totalConfidence = 0;
    const changelogEntries: {
      eventId: string;
      decayed: number;
      days: number;
    }[] = [];

    for (const event of events) {
      const eventMs = new Date(event.eventDate).getTime();
      const daysSince = Math.max(
        0,
        Math.floor((todayMs - eventMs) / (1000 * 60 * 60 * 24))
      );
      const decayed = decayedImpact(event.severity, event.confidence, daysSince);

      totalImpact += decayed;
      totalConfidence += event.confidence;
      changelogEntries.push({
        eventId: event.id,
        decayed,
        days: daysSince,
      });
    }

    const eventImpact = clamp(totalImpact, -30, 30);
    const avgConfidence = totalConfidence / events.length;
    const isLowConfidence = avgConfidence < 0.5;

    const ciBaseline = (await getCiBaseline(db, jurisdiction.id)) ?? 50;
    const pulseScore = clamp(ciBaseline + eventImpact, 0, 100);

    await db
      .insert(pulseDailyScores)
      .values({
        jurisdictionId: jurisdiction.id,
        scoreDate: today,
        ciBaseline,
        eventImpact,
        pulseScore,
        activeEvents: events.length,
        isLowConfidence,
        methodologyVersion,
      })
      .onConflictDoUpdate({
        target: [
          pulseDailyScores.jurisdictionId,
          pulseDailyScores.scoreDate,
        ],
        set: {
          ciBaseline,
          eventImpact,
          pulseScore,
          activeEvents: events.length,
          isLowConfidence,
          methodologyVersion,
          calculatedAt: dsql`NOW()`,
        },
      });

    for (const entry of changelogEntries) {
      await db
        .insert(pulseChangelog)
        .values({
          jurisdictionId: jurisdiction.id,
          scoreDate: today,
          eventId: entry.eventId,
          decayedImpact: entry.decayed,
          daysSinceEvent: entry.days,
        })
        .onConflictDoNothing();
    }

    scoresWritten++;
  }

  return {
    jurisdictionsProcessed: jurisdictionRows.length,
    scoresWritten,
    eventsExpired: expired,
  };
}
