// scripts/sync-country-galleries.ts
//
// One-shot sync that pulls a locator map (P242) + lead image (P18) for
// every ISO-3 country from Wikidata, then writes the result to
// src/lib/data/country-galleries.json so the /factbook/[slug] page
// renders consistent maps + cover photos for ~250 countries.
//
// Run with:  tsx scripts/sync-country-galleries.ts
//
// Why a single SPARQL call vs. 250 REST calls? Wikidata's SPARQL
// endpoint serves the union of P18 + P242 across all countries in one
// request (~50 KB JSON). Per-country Wikipedia REST would be 250x the
// HTTP overhead and trip rate limits.
//
// We don't store binary images. The runtime hotlinks via
// Special:FilePath which is cache-friendly and lets Wikimedia handle
// thumbnail generation at any width we ask for.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface SparqlBinding {
  iso3?: { value: string };
  image?: { value: string };
  locator?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

const SPARQL_QUERY = `
SELECT ?iso3 ?image ?locator WHERE {
  ?country wdt:P298 ?iso3 .
  OPTIONAL { ?country wdt:P18 ?image . }
  OPTIONAL { ?country wdt:P242 ?locator . }
}
ORDER BY ?iso3
`;

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "CivicaAtlas/1.0 (https://civicaatlas.org; admin@civicaatlas.org)";

// Strip Wikimedia FilePath URL → bare file name. The runtime adds the
// width-suffix via wikimediaUrl() so we keep the input shape minimal.
function fileFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = url.match(/Special:FilePath\/(.+?)(\?|$)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

interface CountryGalleryRow {
  locatorMapFile: string | null;
  coverPhotoFile: string | null;
}

async function main() {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(SPARQL_QUERY)}`;
  console.log("Fetching country galleries from Wikidata SPARQL…");

  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as SparqlResponse;
  const bindings = data.results.bindings;
  console.log(`Received ${bindings.length} bindings.`);

  // Wikidata can return multiple P18 statements for the same country
  // (e.g., flag + coat of arms + satellite photo). Collapse to one row
  // per ISO-3, preferring the first non-flag/non-coat-of-arms image.
  const galleries: Record<string, CountryGalleryRow> = {};

  for (const row of bindings) {
    const iso3 = row.iso3?.value;
    if (!iso3 || iso3.length !== 3) continue;

    const image = fileFromUrl(row.image?.value);
    const locator = fileFromUrl(row.locator?.value);

    const existing = galleries[iso3];
    if (!existing) {
      galleries[iso3] = {
        locatorMapFile: locator ?? null,
        coverPhotoFile: image ?? null,
      };
      continue;
    }

    // Backfill missing fields if we got new data this row.
    if (!existing.locatorMapFile && locator) existing.locatorMapFile = locator;

    // Prefer NON-flag, NON-coat-of-arms cover photos. P18 returns
    // multiple statements for some countries.
    if (image && existing.coverPhotoFile) {
      const isFlag = /flag of/i.test(image) || /^Flag_/i.test(image);
      const isCoa = /coat of arms/i.test(image) || /^Coat_of_arms/i.test(image);
      const existingIsFlag =
        /flag of/i.test(existing.coverPhotoFile) ||
        /^Flag_/i.test(existing.coverPhotoFile);
      const existingIsCoa =
        /coat of arms/i.test(existing.coverPhotoFile) ||
        /^Coat_of_arms/i.test(existing.coverPhotoFile);

      // Replace flag/coat-of-arms with anything else.
      if ((existingIsFlag || existingIsCoa) && !isFlag && !isCoa) {
        existing.coverPhotoFile = image;
      }
    } else if (image && !existing.coverPhotoFile) {
      existing.coverPhotoFile = image;
    }
  }

  const isoCount = Object.keys(galleries).length;
  const withMap = Object.values(galleries).filter((g) => g.locatorMapFile).length;
  const withPhoto = Object.values(galleries).filter((g) => g.coverPhotoFile).length;
  console.log(
    `Distinct ISO-3s: ${isoCount} · with locator map: ${withMap} · with cover photo: ${withPhoto}`
  );

  const outPath = resolve(
    process.cwd(),
    "src/lib/data/country-galleries.generated.json"
  );

  // Sort keys alphabetically for stable diffs.
  const sorted = Object.fromEntries(
    Object.entries(galleries).sort(([a], [b]) => a.localeCompare(b))
  );

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        _meta: {
          source: "Wikidata SPARQL (P18, P242)",
          fetchedAt: new Date().toISOString(),
          countCountries: isoCount,
          countWithLocator: withMap,
          countWithCover: withPhoto,
        },
        galleries: sorted,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
