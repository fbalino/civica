/**
 * GDELT query noise measurement — theme filters vs the legacy keyword query.
 *
 *   npx tsx scripts/measure-gdelt-noise.ts
 *
 * Runs the SAME recent window through both the theme query (current default)
 * and the legacy keyword query, printing result counts + a sample of titles
 * from each so the precision difference is visible. Read-only — hits only the
 * public GDELT DOC API, writes nothing, stamps no freshness.
 *
 * NOTE: GDELT rate-limits to one request per ~5s (a faster call returns a
 * plain-text "please limit requests" notice, not JSON). This script spaces its
 * two calls accordingly. If you still see the notice, the calling IP is in a
 * short penalty box from prior polling — wait a minute and re-run, or run from
 * a fresh network. The production cron's IP is not affected by dev polling.
 */
const DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const UA = "CivicaAtlasBot/1.0 (+https://civicaatlas.org; noise measurement)";

const THEME_QUERY =
  "(theme:ARREST OR theme:PROTEST OR theme:TRIAL OR theme:CORRUPTION OR " +
  "theme:ELECTION OR theme:ELECTION_FRAUD OR theme:DEMOCRACY OR " +
  "theme:RESIGNATION OR theme:SANCTIONS OR theme:CENSORSHIP OR " +
  "theme:WB_1176_HUMAN_RIGHTS OR theme:WB_2955_POLITICAL_PROCESSES)";

const KEYWORD_QUERY =
  "(government OR parliament OR election OR coup OR protest OR reform OR " +
  "constitutional OR military OR sanctions OR corruption)";

async function run(label: string, query: string) {
  const url =
    `${DOC_API}?query=${encodeURIComponent(query)}` +
    `&mode=artlist&format=json&maxrecords=75&timespan=24h`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await res.text();
  let data: { articles?: Array<{ title?: string; domain?: string }> };
  try {
    data = JSON.parse(text);
  } catch {
    console.log(`\n${label}: ⚠ ${text.slice(0, 90).trim()}`);
    return;
  }
  const articles = data.articles ?? [];
  console.log(`\n${label}: ${articles.length} articles`);
  for (const a of articles.slice(0, 10)) {
    console.log(`  • ${(a.title ?? "").slice(0, 66)}  [${a.domain}]`);
  }
}

async function main() {
  await run("THEMES (current default)", THEME_QUERY);
  await new Promise((r) => setTimeout(r, 7000)); // respect the 5s rate limit
  await run("KEYWORDS (legacy)", KEYWORD_QUERY);
}

main().then(() => process.exit(0));

export {};
