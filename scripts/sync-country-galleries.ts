// scripts/sync-country-galleries.ts
//
// Builds media metadata for factbook country headers without touching the
// reconciliation identity fields in `jurisdictions`.
//
// Output buckets:
// - mapImages: locator/context maps shown by the Map tile
// - photos: real country photos shown by the Images tile
//
// Run with: tsx scripts/sync-country-galleries.ts

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface SparqlBinding {
  iso3?: { value: string };
  label?: { value: string };
  image?: { value: string };
  locator?: { value: string };
  commonsCategory?: { value: string };
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

interface GeneratedAsset {
  file: string;
  caption: string;
  license: string;
}

interface CountryGalleryRow {
  locatorMapFile: string | null;
  commonsCategory: string | null;
  mapImages: GeneratedAsset[];
  photos: GeneratedAsset[];
}

interface CountryAccumulator {
  iso3: string;
  label: string;
  commonsCategory: string | null;
  imageFiles: Set<string>;
  locatorFiles: Set<string>;
}

interface CommonsPage {
  title: string;
  imageinfo?: Array<{
    mime?: string;
    width?: number;
    height?: number;
    extmetadata?: {
      LicenseShortName?: { value?: string };
    };
  }>;
}

interface CommonsCategoryMember {
  ns: number;
  title: string;
}

interface CommonsQueryResponse {
  query?: {
    pages?: Record<string, CommonsPage>;
    categorymembers?: CommonsCategoryMember[];
  };
}

const SPARQL_QUERY = `
SELECT ?iso3 ?label ?image ?locator ?commonsCategory WHERE {
  ?country wdt:P298 ?iso3 .
  OPTIONAL { ?country rdfs:label ?label FILTER(LANG(?label) = "en") . }
  OPTIONAL { ?country wdt:P18 ?image . }
  OPTIONAL { ?country wdt:P242 ?locator . }
  OPTIONAL { ?country wdt:P373 ?commonsCategory . }
}
ORDER BY ?iso3
`;

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "CivicaAtlas/1.0 (https://civicaatlas.org; admin@civicaatlas.org)";
const MAX_PHOTOS = 8;

const SLUG_ALIASES_BY_ISO3: Record<string, string[]> = {
  CUW: ["curacao"],
  FLK: ["falkland-islands-islas-malvinas"],
  VIR: ["virgin-islands"],
  SGS: ["south-georgia-and-south-sandwich-islands"],
  SJM: [
    "jan-mayen",
    "svalbard-sometimes-referred-to-as-spitsbergen-the-largest-island-in-the-archipelago",
  ],
};

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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function captionFromFile(file: string, fallback: string): string {
  const base = file.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
  return base.length > 0 && base.length < 90 ? base : `${fallback} reference photo`;
}

function stripHtml(value: string | undefined): string {
  return (value ?? "Wikimedia Commons")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Wikimedia Commons";
}

function looksMapLike(file: string): boolean {
  return /(?:map|locator|location|orthographic|projection|globe|world|ocean|unocha|ocha|topograph)/i.test(file);
}

function isRejectedPhotoTitle(file: string): boolean {
  return /(?:flag|coat.of.arms|coat_of_arms|seal|emblem|logo|icon|map|locator|location|orthographic|projection|globe|world map|chart|graph|diagram|climate|demograph|electricity production|passport|stamp|satellite|world.wind|iss\d*|landsat|sentinel|modis|tmo|unocha|ocha)/i.test(file);
}

function isPhotoPage(page: CommonsPage): boolean {
  const info = page.imageinfo?.[0];
  if (!info) return false;

  const file = page.title.replace(/^File:/, "");
  if (isRejectedPhotoTitle(file)) return false;
  if (!["image/jpeg", "image/png", "image/webp"].includes(info.mime ?? "")) {
    return false;
  }

  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (width < 600 || height < 400) return false;

  const ratio = width / height;
  return ratio >= 0.45 && ratio <= 3.2;
}

function isUsefulSubcategory(title: string): boolean {
  if (/(?:map|locator|flag|coat of arms|seal|satellite|svg|diagram|chart)/i.test(title)) {
    return false;
  }
  return /(?:views|panorama|photographs|landscape|cities|city|architecture|buildings|streets|parks|beaches|rivers|mountains|villages|towns|nature|tourism|transport)/i.test(title);
}

async function fetchJson(url: URL): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new Error(`${url.hostname} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchWikidataRows(): Promise<SparqlBinding[]> {
  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", SPARQL_QUERY);
  const data = (await fetchJson(url)) as SparqlResponse;
  return data.results.bindings;
}

async function fetchCategoryFiles(category: string, limit = 60): Promise<CommonsPage[]> {
  const url = new URL(COMMONS_ENDPOINT);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "categorymembers");
  url.searchParams.set("gcmtitle", `Category:${category}`);
  url.searchParams.set("gcmtype", "file");
  url.searchParams.set("gcmlimit", String(limit));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "mime|size|extmetadata");

  const data = (await fetchJson(url)) as CommonsQueryResponse;
  return Object.values(data.query?.pages ?? {});
}

async function fetchSubcategories(category: string, limit = 16): Promise<string[]> {
  const url = new URL(COMMONS_ENDPOINT);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("list", "categorymembers");
  url.searchParams.set("cmtitle", `Category:${category}`);
  url.searchParams.set("cmtype", "subcat");
  url.searchParams.set("cmlimit", String(limit));

  const data = (await fetchJson(url)) as CommonsQueryResponse;
  return (data.query?.categorymembers ?? [])
    .map((member) => member.title.replace(/^Category:/, ""))
    .filter(isUsefulSubcategory);
}

function categoryCandidates(label: string, commonsCategory: string | null): string[] {
  const candidates = [
    `Views of ${label}`,
    `Landscapes of ${label}`,
    `Cities in ${label}`,
    `Architecture of ${label}`,
    `Nature of ${label}`,
    commonsCategory ?? label,
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}

function addPhotoFromPage(
  page: CommonsPage,
  photos: GeneratedAsset[],
  seen: Set<string>,
  fallbackLabel: string
) {
  if (!isPhotoPage(page)) return;

  const file = page.title.replace(/^File:/, "");
  if (seen.has(file)) return;

  const info = page.imageinfo?.[0];
  photos.push({
    file,
    caption: captionFromFile(file, fallbackLabel),
    license: stripHtml(info?.extmetadata?.LicenseShortName?.value),
  });
  seen.add(file);
}

async function collectCommonsPhotos(
  label: string,
  commonsCategory: string | null,
  initialFiles: Set<string>
): Promise<GeneratedAsset[]> {
  const photos: GeneratedAsset[] = [];
  const seen = new Set<string>();

  for (const file of initialFiles) {
    if (!looksMapLike(file) && !isRejectedPhotoTitle(file) && /\.(?:jpe?g|png|webp)$/i.test(file)) {
      photos.push({
        file,
        caption: captionFromFile(file, label),
        license: "Wikimedia Commons",
      });
      seen.add(file);
    }
  }

  for (const category of categoryCandidates(label, commonsCategory)) {
    if (photos.length >= MAX_PHOTOS) break;

    const directPages = await fetchCategoryFiles(category);
    for (const page of directPages) {
      addPhotoFromPage(page, photos, seen, label);
      if (photos.length >= MAX_PHOTOS) break;
    }
    if (photos.length >= MAX_PHOTOS) break;

    const subcategories = await fetchSubcategories(category);
    for (const subcategory of subcategories.slice(0, 4)) {
      const pages = await fetchCategoryFiles(subcategory, 40);
      for (const page of pages) {
        addPhotoFromPage(page, photos, seen, label);
        if (photos.length >= MAX_PHOTOS) break;
      }
      if (photos.length >= MAX_PHOTOS) break;
    }
  }

  return photos.slice(0, MAX_PHOTOS);
}

function mapAsset(file: string, label: string, caption?: string): GeneratedAsset {
  return {
    file,
    caption: caption ?? captionFromFile(file, label),
    license: "Wikimedia Commons",
  };
}

async function main() {
  console.log("Fetching country media identities from Wikidata SPARQL...");
  const bindings = await fetchWikidataRows();
  console.log(`Received ${bindings.length} bindings.`);

  const byIso3 = new Map<string, CountryAccumulator>();
  for (const row of bindings) {
    const iso3 = row.iso3?.value;
    if (!iso3 || iso3.length !== 3) continue;

    const existing =
      byIso3.get(iso3) ??
      ({
        iso3,
        label: row.label?.value ?? iso3,
        commonsCategory: row.commonsCategory?.value ?? null,
        imageFiles: new Set<string>(),
        locatorFiles: new Set<string>(),
      } satisfies CountryAccumulator);

    if (!existing.commonsCategory && row.commonsCategory?.value) {
      existing.commonsCategory = row.commonsCategory.value;
    }
    if (existing.label === iso3 && row.label?.value) existing.label = row.label.value;

    const image = fileFromUrl(row.image?.value);
    const locator = fileFromUrl(row.locator?.value);
    if (image) existing.imageFiles.add(image);
    if (locator) existing.locatorFiles.add(locator);

    byIso3.set(iso3, existing);
  }

  const galleries: Record<string, CountryGalleryRow> = {};
  const slugIndex: Record<string, string> = {};
  let processed = 0;

  for (const country of [...byIso3.values()].sort((a, b) => a.iso3.localeCompare(b.iso3))) {
    processed++;
    if (processed % 25 === 0) {
      console.log(`  Processed ${processed}/${byIso3.size} countries...`);
    }

    const mapImages: GeneratedAsset[] = [];
    for (const locator of country.locatorFiles) {
      mapImages.push(mapAsset(locator, country.label, `${country.label} locator map`));
    }
    for (const image of country.imageFiles) {
      if (looksMapLike(image) && !mapImages.some((asset) => asset.file === image)) {
        mapImages.push(mapAsset(image, country.label));
      }
    }

    const photos = await collectCommonsPhotos(
      country.label,
      country.commonsCategory,
      country.imageFiles
    );

    galleries[country.iso3] = {
      locatorMapFile: mapImages[0]?.file ?? null,
      commonsCategory: country.commonsCategory,
      mapImages,
      photos,
    };

    slugIndex[slugify(country.label)] = country.iso3;
    for (const alias of SLUG_ALIASES_BY_ISO3[country.iso3] ?? []) {
      slugIndex[alias] = country.iso3;
    }
  }

  const countryRows = Object.values(galleries);
  const withMap = countryRows.filter((g) => g.mapImages.length > 0).length;
  const withPhotos = countryRows.filter((g) => g.photos.length > 0).length;
  const withMultiplePhotos = countryRows.filter((g) => g.photos.length > 1).length;

  const outPath = resolve(
    process.cwd(),
    "src/lib/data/country-galleries.generated.json"
  );

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        _meta: {
          source: "Wikidata SPARQL (P18, P242, P373) + Wikimedia Commons category photos",
          fetchedAt: new Date().toISOString(),
          countCountries: countryRows.length,
          countWithMap: withMap,
          countWithPhotos: withPhotos,
          countWithMultiplePhotos: withMultiplePhotos,
          photoPolicy:
            "Strict country photos only; maps, flags, seals, charts, SVGs, videos, PDFs, and satellite/ISS imagery are excluded from photos.",
        },
        slugIndex: Object.fromEntries(
          Object.entries(slugIndex).sort(([a], [b]) => a.localeCompare(b))
        ),
        galleries: Object.fromEntries(
          Object.entries(galleries).sort(([a], [b]) => a.localeCompare(b))
        ),
      },
      null,
      2
    ) + "\n"
  );

  console.log(
    `Distinct ISO-3s: ${countryRows.length} · with map: ${withMap} · with photos: ${withPhotos} · with 2+ photos: ${withMultiplePhotos}`
  );
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
