/**
 * Backfill: re-enrich Pulse GDELT `raw_events` bodies with article text.
 *
 * WHAT IT DOES
 *   GDELT rows were historically stored with `body` = just the outlet domain
 *   (e.g. "eturbonews.com") because GDELT returns only headline + URL. This
 *   script re-fetches the live article for recent GDELT rows whose body is
 *   missing or is still just a bare domain, extracts readable text with the
 *   same `extractArticleText()` used by the live connector, and updates the
 *   row in place.
 *
 * WHAT IT DOES NOT DO
 *   - It does NOT reclassify. It does not touch `pulse_events_v2`, clusters,
 *     deltas, or scores — bodies only. Re-classification (if wanted) is a
 *     separate, explicitly-run step.
 *   - It does NOT stamp `sources.last_sync_at`. This is LOCAL enrichment of
 *     already-ingested rows, not a source sync — there is no new upstream
 *     fetch of the GDELT feed, so faking source freshness would be wrong.
 *     (`last_sync_at` may only be stamped by markSourcesSynced() anyway.)
 *
 * USAGE
 *   npm run pulse:reenrich-articles                 # dry-run, last 7 days
 *   npm run pulse:reenrich-articles -- --days=14    # dry-run, last 14 days
 *   npm run pulse:reenrich-articles -- --apply      # write updates
 *   npm run pulse:reenrich-articles -- --apply --days=3 --concurrency=8
 *
 * DB access: run from repo root via `npx tsx`. Reads DATABASE_URL from
 * .env.local. If dotenv doesn't pick it up in your shell:
 *   set -a; source <(grep -E '^DATABASE_URL=' .env.local); set +a
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { extractArticleText } from "../src/lib/pulse/v2/article-extract";

const sql = neon(process.env.DATABASE_URL!);

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY; // default is dry-run

function argNum(flag: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!hit) return fallback;
  const n = Number(hit.slice(flag.length + 1));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DAYS = argNum("--days", 7);
const CONCURRENCY = argNum("--concurrency", 5);

interface Row {
  id: string;
  sourceUrl: string | null;
  title: string;
  body: string | null;
}

/**
 * A body is "just a domain" when it has no spaces and looks like host.tld —
 * i.e. the old `extractSourceName(domain)` placeholder. Real article text has
 * spaces. We re-enrich rows whose body is NULL, empty, or a bare domain.
 */
function bodyIsDomainOrEmpty(body: string | null): boolean {
  if (!body) return true;
  const t = body.trim();
  if (t.length === 0) return true;
  if (/\s/.test(t)) return false; // has whitespace → real text
  // No whitespace: treat host-like tokens as the placeholder domain.
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t) || t.length < 30;
}

async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function main() {
  console.log(
    `\n=== Pulse GDELT re-enrich — ${APPLY ? "APPLY" : "DRY-RUN"} · last ${DAYS}d · concurrency ${CONCURRENCY} ===`
  );
  console.log(
    `(bodies only — does NOT reclassify, does NOT touch pulse_events_v2, does NOT stamp last_sync_at)\n`
  );

  // Pull recent GDELT rows. We over-select (all recent GDELT rows) and filter
  // "domain-or-empty" in JS, since detecting a bare domain in SQL is brittle.
  const raw = (await sql`
    SELECT id, source_url, title, body
    FROM raw_events
    WHERE source_id = 'gdelt'
      AND retrieved_at >= NOW() - (${DAYS} || ' days')::interval
    ORDER BY retrieved_at DESC
  `) as Record<string, unknown>[];

  const candidates: Row[] = raw
    .map((r) => ({
      id: String(r.id),
      sourceUrl: r.source_url ? String(r.source_url) : null,
      title: String(r.title ?? ""),
      body: r.body === null || r.body === undefined ? null : String(r.body),
    }))
    .filter((r) => bodyIsDomainOrEmpty(r.body) && r.sourceUrl);

  console.log(
    `Found ${raw.length} GDELT rows in window · ${candidates.length} need re-enrichment (missing / domain-only body)\n`
  );

  if (candidates.length === 0) {
    console.log("Nothing to do.\n");
    process.exit(0);
  }

  let enriched = 0;
  let blocked = 0;
  let updated = 0;

  await pool(candidates, CONCURRENCY, async (row) => {
    let text: string | null = null;
    try {
      text = await extractArticleText(row.sourceUrl!);
    } catch {
      text = null;
    }

    if (!text) {
      blocked++;
      console.log(
        `  [skip] ${row.id.slice(0, 8)} · kept "${(row.body ?? "").slice(0, 40)}" · ${row.title.slice(0, 60)}`
      );
      return;
    }

    enriched++;
    console.log(
      `  [ok]   ${row.id.slice(0, 8)} · +${text.length} chars · ${row.title.slice(0, 60)}`
    );

    if (APPLY) {
      await sql`UPDATE raw_events SET body = ${text} WHERE id = ${row.id}`;
      updated++;
    }
  });

  console.log(
    `\nSummary: ${candidates.length} candidates · ${enriched} extractable · ${blocked} blocked/thin (kept fallback)` +
      (APPLY ? ` · ${updated} rows updated` : "")
  );

  if (DRY_RUN) {
    console.log(
      "\nDRY-RUN complete. No rows written. Re-run with --apply to persist.\n"
    );
  } else {
    console.log("\nDONE. Bodies updated in place (no reclassify, no last_sync_at).\n");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
