/**
 * Phase 5.8 — load hand-curated backtest cases into the DB.
 *
 * Reads `data/backtest/*.json`, upserts to `backtest_cases` and
 * `backtest_events`. Idempotent — safe to re-run after editing the
 * JSON files. Existing events for a case are deleted and re-inserted
 * to keep the seed in sync.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/lib/db/schema";

interface CaseExpected {
  dimension: string;
  direction: "positive" | "negative" | "mixed";
  magnitude: "moderate" | "severe" | "catastrophic";
}

interface CaseEvent {
  eventDate: string;
  sourceId: string;
  sourceType: "specialist" | "news";
  title: string;
  body?: string;
  hintCategory?: string;
  hintDimension?: string;
  hintSeverityTier?: string;
}

interface CaseFile {
  id: string;
  countryName: string;
  countryIso3?: string;
  eventDate: string;
  description: string;
  expected: CaseExpected[];
  events: CaseEvent[];
}

async function main() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const dir = join(process.cwd(), "data/backtest");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  console.log(`Found ${files.length} case file(s) under ${dir}\n`);

  let casesUpserted = 0;
  let eventsInserted = 0;

  for (const filename of files) {
    const raw = readFileSync(join(dir, filename), "utf-8");
    const data = JSON.parse(raw) as CaseFile;

    // Upsert case
    await db
      .insert(schema.backtestCases)
      .values({
        id: data.id,
        countryName: data.countryName,
        countryIso3: data.countryIso3 ?? null,
        eventDate: data.eventDate,
        description: data.description,
        expected: data.expected,
      })
      .onConflictDoUpdate({
        target: schema.backtestCases.id,
        set: {
          countryName: data.countryName,
          countryIso3: data.countryIso3 ?? null,
          eventDate: data.eventDate,
          description: data.description,
          expected: data.expected,
        },
      });
    casesUpserted++;

    // Replace events for this case (idempotent re-runs)
    await db
      .delete(schema.backtestEvents)
      .where(eq(schema.backtestEvents.caseId, data.id));

    for (const ev of data.events) {
      await db.insert(schema.backtestEvents).values({
        caseId: data.id,
        eventDate: ev.eventDate,
        sourceId: ev.sourceId,
        sourceType: ev.sourceType,
        title: ev.title,
        body: ev.body ?? null,
        hintCategory: ev.hintCategory ?? null,
        hintDimension: ev.hintDimension ?? null,
        hintSeverityTier: ev.hintSeverityTier ?? null,
      });
      eventsInserted++;
    }

    console.log(
      `  ✓ ${data.id} — ${data.events.length} event(s), ${data.expected.length} expected outcome(s)`
    );
  }

  console.log(
    `\nDone. ${casesUpserted} cases · ${eventsInserted} events written.`
  );

  // Sanity check
  const counts = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM backtest_cases)::int  AS cases,
      (SELECT COUNT(*) FROM backtest_events)::int AS events
  `);
  const row = ((counts as unknown as { rows?: unknown[] }).rows ??
    counts) as Array<Record<string, unknown>>;
  console.log(`DB state: ${row[0]?.cases} cases · ${row[0]?.events} events.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
