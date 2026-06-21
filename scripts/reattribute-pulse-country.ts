/**
 * Pulse country re-attribution pass (retro-fix existing rows).
 *
 * Problem: the v2 ingest's country resolver keys off country mentions /
 * source-language / outlet origin, so events get attributed to the wrong
 * country (e.g. a Portuguese-outlet story about US politics → Brazil; a
 * Chinese-language story about US redistricting → Taiwan; a Romanian story
 * about Hungary's LGBTQ law → Romania).
 *
 * This script re-classifies every existing pulse_events_v2 row by its
 * SUBJECT country (shared brain in src/lib/pulse/v2/country-attribution.ts,
 * the same one now wired into the live classify pipeline) and re-attributes
 * wrongly-tagged events to the correct country.
 *
 * Usage:
 *   tsx scripts/reattribute-pulse-country.ts            # dry-run (no writes)
 *   tsx scripts/reattribute-pulse-country.ts --apply    # apply + recompute deltas
 *
 * Writes a full proposal report to
 * ~/civica/plan/pulse-reattribution-<date>.md (path overridable via --out=).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { calculateDimensionalDeltas } from "../src/lib/pulse/v2/score";
import {
  classifySubjectCountry,
  type SubjectVerdict,
} from "../src/lib/pulse/v2/country-attribution";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 6;

interface EventRow {
  id: string;
  currentIso3: string | null;
  currentName: string;
  eventDate: string;
  published: boolean;
  headline: string;
  description: string;
}

const rows = (r: unknown) =>
  (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function main() {
  console.log(`Pulse country re-attribution — ${APPLY ? "APPLY" : "DRY-RUN"} mode\n`);

  // ISO3 -> jurisdiction
  const jur = rows(
    await db.execute(sql`SELECT id, iso3, name FROM jurisdictions WHERE iso3 IS NOT NULL`)
  );
  const byIso3 = new Map<string, { id: string; name: string }>();
  for (const j of jur)
    byIso3.set(String(j.iso3).toUpperCase(), { id: String(j.id), name: String(j.name) });

  const events: EventRow[] = rows(
    await db.execute(sql`
      SELECT e.id, j.iso3 AS current_iso3, j.name AS current_name,
             e.event_date, e.published, e.headline, e.description
      FROM pulse_events_v2 e JOIN jurisdictions j ON e.jurisdiction_id = j.id
      ORDER BY e.event_date DESC`)
  ).map((r) => ({
    id: String(r.id),
    currentIso3: r.current_iso3 ? String(r.current_iso3) : null,
    currentName: String(r.current_name),
    eventDate: String(r.event_date),
    published: Boolean(r.published),
    headline: String(r.headline),
    description: r.description ? String(r.description) : "",
  }));

  console.log(`Classifying ${events.length} pulse_events_v2 rows by subject country...\n`);
  const verdicts = await pool(events, CONCURRENCY, (ev) =>
    classifySubjectCountry(ev.headline, ev.description)
  );

  const changes: { ev: EventRow; v: SubjectVerdict; newId: string; newIso3: string }[] = [];
  const flags: { ev: EventRow; v: SubjectVerdict | null; reason: string }[] = [];
  let correct = 0;

  events.forEach((ev, i) => {
    const v = verdicts[i];
    if (!v) return flags.push({ ev, v: null, reason: "classify-error" });
    if (v.scope !== "single" || !v.iso3)
      return flags.push({ ev, v, reason: `not-single (${v.scope})` });
    const iso3 = v.iso3.toUpperCase();
    const target = byIso3.get(iso3);
    if (!target) return flags.push({ ev, v, reason: `no-jurisdiction-for-${iso3}` });
    if (ev.currentIso3 && iso3 === ev.currentIso3.toUpperCase()) return void correct++;
    if (v.confidence === "low")
      return flags.push({ ev, v, reason: `differs-but-low-confidence (→${iso3})` });
    changes.push({ ev, v, newId: target.id, newIso3: iso3 });
  });

  const lines: string[] = [];
  lines.push(`# Pulse country re-attribution — ${APPLY ? "APPLIED" : "DRY-RUN"} (2026-06-20)\n`);
  lines.push(
    `Total events: ${events.length} · already-correct: ${correct} · proposed changes: ${changes.length} · flagged (no change): ${flags.length}\n`
  );
  lines.push(`## Proposed re-attributions (${changes.length})\n`);
  for (const c of changes)
    lines.push(
      `- **${c.ev.currentIso3} → ${c.newIso3}** (${c.v.confidence}) — ${c.ev.headline.slice(0, 110)}\n  _${c.v.reasoning}_`
    );
  lines.push(`\n## Flagged for manual review (${flags.length})\n`);
  for (const f of flags)
    lines.push(`- [${f.ev.currentIso3}] (${f.reason}) — ${f.ev.headline.slice(0, 110)}`);

  const outPath =
    process.argv.find((a) => a.startsWith("--out="))?.slice(6) ??
    "/Users/fernandobalino/civica/plan/pulse-reattribution-2026-06-20.md";
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outPath, lines.join("\n"));

  console.log(
    `\nSummary: ${events.length} events · ${correct} already correct · ${changes.length} to re-attribute · ${flags.length} flagged`
  );
  console.log(`Report written to ${outPath}\n`);
  for (const c of changes.slice(0, 25))
    console.log(`  ${c.ev.currentIso3} → ${c.newIso3}  ${c.ev.headline.slice(0, 80)}`);

  if (!APPLY) {
    console.log("\nDRY-RUN complete. Re-run with --apply to write changes + recompute deltas.");
    process.exit(0);
  }

  console.log(`\nApplying ${changes.length} re-attributions...`);
  for (const c of changes) {
    await db.execute(
      sql`UPDATE pulse_events_v2 SET jurisdiction_id = ${c.newId}, updated_at = now() WHERE id = ${c.ev.id}`
    );
  }
  console.log("Clearing stale dimensional deltas and recomputing...");
  await db.execute(sql`DELETE FROM pulse_dimensional_deltas`);
  const summary = await calculateDimensionalDeltas(db);
  console.log("Recompute summary:", summary);
  console.log("\nDONE.");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
