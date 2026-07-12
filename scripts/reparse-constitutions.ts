/**
 * reparse-constitutions — re-parse already-synced constitution HTML in place.
 *
 * This is a LOCAL RE-PARSE, not a source fetch. It re-runs the current
 * `parseConstitutionHtml()` over each `constitutions.full_text_html` (the source
 * HTML we already stored during the last `sync:constitutions` run) and rewrites
 * the derived `structured_articles` + `constitution_topic_excerpts`. It never
 * touches the network and never re-crawls Constitute.
 *
 * WHY IT EXISTS: an earlier parser dropped every bare child `div.section` that
 * had no topic tags and no own heading. In ~43 constitutions (Japan, Venezuela,
 * Norway, Qatar, North Korea, …) Constitute nests each article's clause text in
 * exactly such a section, so the body text was stored nowhere and articles
 * rendered heading-only. The parser now keeps a section when it has topics OR a
 * heading OR its own body text; this script backfills that fix onto the rows we
 * already have, WITHOUT re-fetching anything.
 *
 * The parser also excludes descendant `div.section` subtrees at ANY depth from
 * each entry's own `html` (not just direct children), so a section nested
 * behind an intermediate wrapper (`<ol><li><div class="section">…`) renders
 * only as its own entry, never verbatim inside its parent too. The re-parse
 * loop carries a content-drift guard for this invariant: any parsed entry
 * whose `html` still contains `class="section"` markup is counted and warned
 * about — the expected count is 0 everywhere.
 *
 *   Run with:
 *     npm run reparse:constitutions -- --dry-run            (inspect, write nothing)
 *     npm run reparse:constitutions -- --dry-run --slugs=japan
 *     npm run reparse:constitutions -- --slugs=japan,norway,venezuela
 *     npm run reparse:constitutions                         (full apply)
 *
 *   Flags:
 *     --dry-run          re-parse + report deltas, write nothing.
 *     --slugs=a,b,c      restrict to these Civica jurisdiction slug(s).
 *
 * PROVENANCE — DELIBERATELY DOES NOT STAMP `sources.last_sync_at`.
 * Freshness reflects when the SOURCE was last fetched. This script fetches
 * nothing; it only re-derives structure from HTML already on disk. Advancing
 * `last_sync_at` here would falsely claim a fresh Constitute crawl. It writes
 * only `constitutions.structured_articles` (NOT `full_text_html`) and the
 * `constitution_topic_excerpts` rows. `npm run validate:sync-freshness`
 * confirms no `last_sync_at` write path lives in this file.
 *
 * Neon HTTP payload limits: one constitutions row is updated at a time, and the
 * excerpt insertion is already byte-aware-chunked inside `replaceTopicExcerpts`.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db } from "../src/lib/db";
import { jurisdictions, constitutions } from "../src/lib/db/schema";
import {
  parseConstitutionHtml,
  replaceCurrentConstitutionPassages,
  replaceTopicExcerpts,
  type StructuredArticle,
  type ParsedSection,
} from "../src/lib/constitute/sync-constitutions";

interface CliArgs {
  dryRun: boolean;
  slugs: string[] | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, slugs: null };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--slugs=")) {
      const list = a
        .slice("--slugs=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length) args.slugs = list;
    }
  }
  return args;
}

/** Average length of the stored `html` field across a section list. */
function avgHtmlLen(articles: Array<{ html: string }>): number {
  if (articles.length === 0) return 0;
  const total = articles.reduce((n, a) => n + (a.html?.length ?? 0), 0);
  return Math.round(total / articles.length);
}

/** Reduce a parsed section to the 4-field shape stored in `structured_articles`. */
function toStoredArticle(a: ParsedSection): StructuredArticle {
  return {
    sectionId: a.sectionId,
    headingLabel: a.headingLabel,
    topics: a.topics,
    html: a.html,
  };
}

interface CountRow {
  n: number;
  avg: number;
}

function countsOf(articles: Array<{ html: string }>): CountRow {
  return { n: articles.length, avg: avgHtmlLen(articles) };
}

function fmtDelta(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log("=== Constitution re-parse (local, no source fetch) ===");
  if (args.dryRun) console.log("MODE: dry run (no writes)");
  if (args.slugs) console.log(`SLUGS: ${args.slugs.join(", ")}`);
  console.log("");

  // Cheap directory query — ids + names only. The heavy columns
  // (full_text_html up to ~1.5MB, structured_articles) would blow the Neon
  // HTTP 64MB response cap if selected across all 186 rows, so each is fetched
  // one row at a time inside the loop below.
  const directory = await db
    .select({
      constitutionId: constitutions.id,
      jurisdictionId: constitutions.jurisdictionId,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      sourceDocumentId: constitutions.constituteProjectId,
      lastFetched: constitutions.lastFetched,
    })
    .from(constitutions)
    .innerJoin(
      jurisdictions,
      eq(jurisdictions.id, constitutions.jurisdictionId),
    );

  const wantSlugs = args.slugs ? new Set(args.slugs) : null;
  const targets = directory.filter((r) => !wantSlugs || wantSlugs.has(r.slug));

  if (wantSlugs) {
    const found = new Set(targets.map((t) => t.slug));
    for (const s of wantSlugs) {
      if (!found.has(s)) {
        console.log(`  ⚠ no constitution for slug "${s}" — skipped`);
      }
    }
  }

  console.log(`Re-parsing ${targets.length} constitution(s).\n`);

  let updated = 0;
  let excerptsTotal = 0;
  let articlesAddedTotal = 0;
  let skipped = 0;
  let driftEntriesTotal = 0;
  let driftConstitutions = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];

    // Fetch this one row's heavy columns (stays under the Neon HTTP cap).
    const [heavy] = await db
      .select({
        fullTextHtml: constitutions.fullTextHtml,
        structuredArticles: constitutions.structuredArticles,
      })
      .from(constitutions)
      .where(eq(constitutions.id, t.constitutionId))
      .limit(1);

    if (!heavy?.fullTextHtml) {
      skipped++;
      console.log(
        `[${i + 1}/${targets.length}] ${t.name} (${t.slug}) — no full_text_html, skipped`,
      );
      continue;
    }

    const before = countsOf(
      (heavy.structuredArticles as Array<{ html: string }> | null) ?? [],
    );

    let parsed: ParsedSection[];
    try {
      parsed = parseConstitutionHtml(heavy.fullTextHtml);
    } catch (err) {
      const reason = (err as Error)?.message ?? String(err);
      console.log(
        `[${i + 1}/${targets.length}] ${t.name} (${t.slug}) — PARSE FAILED: ${reason}`,
      );
      continue;
    }

    const after = countsOf(parsed);
    const nDelta = after.n - before.n;
    const avgDelta = after.avg - before.avg;
    articlesAddedTotal += nDelta;

    // Content-drift guard: no parsed entry's own html may embed a nested
    // section's markup (the nested section renders as its own entry — keeping
    // it inline duplicates the clause in the reading column). Post-fix this
    // count is 0 everywhere; a non-zero count means the parser regressed.
    const driftEntries = parsed.filter((a) =>
      a.html.includes('class="section"'),
    ).length;
    if (driftEntries > 0) {
      driftEntriesTotal += driftEntries;
      driftConstitutions++;
      console.log(
        `  ⚠ DRIFT ${t.slug}: ${driftEntries} parsed entr${driftEntries === 1 ? "y" : "ies"} still embed nested class="section" markup`,
      );
    }

    const line =
      `[${i + 1}/${targets.length}] ${t.name.padEnd(24)} (${t.slug}) ` +
      `articles ${before.n}→${after.n} (${fmtDelta(nDelta)})  ` +
      `avg html ${before.avg}→${after.avg} (${fmtDelta(avgDelta)})`;

    if (args.dryRun) {
      console.log(`${line}  [dry run]`);
      continue;
    }

    // Apply: one constitutions row at a time (Neon HTTP payload safety); the
    // excerpt insertion is byte-aware-chunked inside replaceTopicExcerpts.
    const storedArticles: StructuredArticle[] = parsed.map(toStoredArticle);
    await db
      .update(constitutions)
      .set({ structuredArticles: storedArticles }) // full_text_html untouched
      .where(eq(constitutions.id, t.constitutionId));

    const excerptRows = await replaceTopicExcerpts(
      db,
      t.jurisdictionId,
      t.constitutionId,
      parsed,
    );
    if (!t.sourceDocumentId || !t.lastFetched) {
      throw new Error(
        `${t.slug} lacks source document identity or retrieval time; passage index fails closed`,
      );
    }
    await replaceCurrentConstitutionPassages(db, {
      constitutionId: t.constitutionId,
      jurisdictionId: t.jurisdictionId,
      sourceDocumentId: t.sourceDocumentId,
      retrievedAt: t.lastFetched,
      articles: storedArticles,
    });
    excerptsTotal += excerptRows;
    updated++;
    console.log(`${line}  ✓ ${excerptRows} excerpts`);
  }

  console.log("\n========================================================");
  console.log(
    `  Constitution re-parse ${args.dryRun ? "— DRY RUN (nothing written)" : "— APPLIED"}`,
  );
  console.log("========================================================");
  console.log(`  Constitutions considered:   ${targets.length}`);
  if (skipped > 0) console.log(`  Skipped (no full_text_html): ${skipped}`);
  if (!args.dryRun) {
    console.log(`  Constitutions updated:      ${updated}`);
    console.log(`  Topic excerpts rebuilt:     ${excerptsTotal}`);
  }
  console.log(`  Net article-count change:   ${fmtDelta(articlesAddedTotal)}`);
  if (driftEntriesTotal > 0) {
    console.log(
      `  ⚠ DRIFT WARNING: ${driftEntriesTotal} parsed entries across ${driftConstitutions} constitution(s) embed nested class="section" markup (expected 0)`,
    );
  } else {
    console.log(
      '  Nested-section drift guard: 0 entries embed class="section" ✓',
    );
  }
  console.log(
    "  (sources.last_sync_at intentionally NOT stamped — local re-parse.)",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFATAL:", err);
    process.exit(1);
  });
