// Per-country photo + locator-map data, sourced from Wikimedia Commons.
//
// Two layers, in priority order:
//   1. Hand-curated MULTI-PHOTO galleries (rich captions, multiple
//      shots) for a small set of seed countries.
//   2. Wikidata/Commons-sourced locator maps + real photos for ALL
//      countries, generated from `scripts/sync-country-galleries.ts`
//      into `country-galleries.generated.json`.
//
// Layer 2 keeps map-like assets out of the photo gallery. Slug lookup is
// intentionally media-only; it does not imply a jurisdiction has ISO or
// Wikidata identity fields for reconciliation.

import generated from "./country-galleries.generated.json";

export interface CountryPhoto {
  /** Wikimedia Commons file name (without "File:" prefix). */
  file: string;
  caption: string;
  credit?: string;
  license?: string;
}

export interface CountryGallery {
  /** Wikimedia file name for the locator/relief map. */
  locatorMapFile: string | null;
  /** Locator/context maps shown from the Map tile. */
  mapImages: CountryPhoto[];
  /** Real country photos shown from the Images tile. */
  photos: CountryPhoto[];
}

interface GeneratedAsset {
  file: string;
  caption?: string;
  license?: string;
}

interface GeneratedRow {
  locatorMapFile?: string | null;
  coverPhotoFile?: string | null;
  mapImages?: GeneratedAsset[];
  photos?: GeneratedAsset[];
  commonsCategory?: string | null;
}

interface GeneratedFile {
  _meta: unknown;
  galleries: Record<string, GeneratedRow>;
  slugIndex?: Record<string, string>;
}

const GENERATED = generated as GeneratedFile;

// Marquee countries with multi-photo curated galleries. File names
// were verified against real Commons entries via the Wikipedia REST
// page-summary API.
const CURATED: Record<string, CountryGallery> = {
  NGA: {
    locatorMapFile: "Nigeria_in_Africa_(-mini_map_-rivers).svg",
    mapImages: [
      { file: "Nigeria_in_Africa_(-mini_map_-rivers).svg", caption: "Nigeria locator map", license: "Wikimedia Commons" },
    ],
    photos: [
      { file: "Tafa_Balewa_Square_(Onikan)_in_Lagos._Nigeria.jpg", caption: "Tafawa Balewa Square, Lagos", license: "CC BY-SA" },
      { file: "Abuja_heritages_30.jpg", caption: "Abuja, federal capital", license: "CC BY-SA" },
      { file: "Zuma_Rock.jpg", caption: "Zuma Rock, near Abuja", license: "CC BY-SA" },
      { file: "Yankari_Entry_Gate.jpg", caption: "Yankari National Park, Bauchi", license: "CC BY-SA" },
      { file: "Front_of_Sokoto_Sultan_Palce.jpg", caption: "Sultan's Palace, Sokoto", license: "CC BY-SA" },
      { file: "Eyo_Olokun.jpg", caption: "Eyo Festival, Lagos", license: "CC BY-SA" },
    ],
  },
  USA: {
    locatorMapFile: "United_States_(orthographic_projection).svg",
    mapImages: [
      { file: "United_States_(orthographic_projection).svg", caption: "United States locator map", license: "Wikimedia Commons" },
    ],
    photos: [
      { file: "Front_view_of_Statue_of_Liberty_(cropped).jpg", caption: "Statue of Liberty, New York", license: "CC BY-SA" },
      { file: "Capitol_Building_Full_View.jpg", caption: "United States Capitol, Washington DC", license: "Public domain" },
      { file: "White_House_north_and_south_sides.jpg", caption: "The White House", license: "Public domain" },
      { file: "Half_Dome_with_Eastern_Yosemite_Valley_(50MP).jpg", caption: "Yosemite National Park", license: "CC BY-SA" },
    ],
  },
  GBR: {
    locatorMapFile: "United_Kingdom_(orthographic_projection).svg",
    mapImages: [
      { file: "United_Kingdom_(orthographic_projection).svg", caption: "United Kingdom locator map", license: "Wikimedia Commons" },
    ],
    photos: [
      { file: "Houses_of_Parliament_in_2022_(cropped).jpg", caption: "Palace of Westminster, London", license: "CC BY-SA" },
      { file: "Elizabeth_Tower,_June_2022.jpg", caption: "Big Ben, London", license: "CC BY-SA" },
      { file: "City_of_Edinburgh_-_Edinburgh_Castle_-_20140421004403.jpg", caption: "Edinburgh Castle", license: "CC BY-SA" },
    ],
  },
  FRA: {
    locatorMapFile: "France_(orthographic_projection).svg",
    mapImages: [
      { file: "France_(orthographic_projection).svg", caption: "France locator map", license: "Wikimedia Commons" },
    ],
    photos: [
      { file: "Tour_Eiffel_Wikimedia_Commons_(cropped).jpg", caption: "Eiffel Tower, Paris", license: "CC BY-SA" },
      { file: "Louvre_Museum_Wikimedia_Commons.jpg", caption: "Louvre Museum, Paris", license: "CC BY-SA" },
    ],
  },
  BRA: {
    locatorMapFile: "Brazil_(orthographic_projection).svg",
    mapImages: [
      { file: "Brazil_(orthographic_projection).svg", caption: "Brazil locator map", license: "Wikimedia Commons" },
    ],
    photos: [
      { file: "Christ_the_Redeemer_-_Cristo_Redentor.jpg", caption: "Christ the Redeemer, Rio de Janeiro", license: "CC BY-SA" },
      { file: "Praia_de_Copacabana_-_Rio_de_Janeiro,_Brasil.jpg", caption: "Copacabana beach, Rio de Janeiro", license: "CC BY-SA" },
    ],
  },
};

/** Wikimedia file URL via the FilePath redirector — survives hash schema
 *  changes and works for any valid Commons filename. */
export function wikimediaUrl(file: string, width = 1200): string {
  const safe = encodeURIComponent(file).replace(/'/g, "%27");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${safe}?width=${width}`;
}

export function getCountryGallery(
  identity:
    | string
    | null
    | undefined
    | { iso3?: string | null | undefined; slug?: string | null | undefined }
): CountryGallery | null {
  const iso3 = typeof identity === "string" ? identity : identity?.iso3;
  const slug = typeof identity === "string" ? null : identity?.slug;
  const key = iso3?.toUpperCase() ?? (slug ? GENERATED.slugIndex?.[slug] : null);
  if (!key) return null;

  // Curated multi-photo galleries take priority.
  const curated = CURATED[key];
  if (curated) return curated;

  // Fall back to the generated Wikimedia gallery.
  const row = GENERATED.galleries[key];
  if (!row) return null;

  const generatedMaps = row.mapImages?.map((asset) => generatedAssetToPhoto(asset, key)) ?? [];
  const generatedPhotos = row.photos?.map((asset) => generatedAssetToPhoto(asset, key)) ?? [];

  // Backward compatibility for the legacy generated shape. Important:
  // map-like legacy `coverPhotoFile` values must not count as photos.
  const legacyMaps: CountryPhoto[] = [];
  if (row.locatorMapFile) {
    legacyMaps.push({
      file: row.locatorMapFile,
      caption: `${key} locator map`,
      license: "Wikimedia Commons",
    });
  }
  if (row.coverPhotoFile && looksMapLike(row.coverPhotoFile)) {
    legacyMaps.push({
      file: row.coverPhotoFile,
      caption: prettyCaptionFromFile(row.coverPhotoFile, key),
      license: "Wikimedia Commons",
    });
  }

  const legacyPhotos: CountryPhoto[] =
    row.coverPhotoFile && looksLikeCountryPhoto(row.coverPhotoFile)
      ? [
          {
            file: row.coverPhotoFile,
            caption: prettyCaptionFromFile(row.coverPhotoFile, key),
            license: "Wikimedia Commons",
          },
        ]
      : [];

  return {
    locatorMapFile: row.locatorMapFile ?? generatedMaps[0]?.file ?? null,
    mapImages: generatedMaps.length > 0 ? generatedMaps : legacyMaps,
    photos: generatedPhotos.length > 0 ? generatedPhotos : legacyPhotos,
  };
}

function generatedAssetToPhoto(asset: GeneratedAsset, iso3: string): CountryPhoto {
  return {
    file: asset.file,
    caption: asset.caption ?? prettyCaptionFromFile(asset.file, iso3),
    license: asset.license ?? "Wikimedia Commons",
  };
}

function looksMapLike(file: string): boolean {
  return /(?:map|locator|location|orthographic|projection|globe|world|ocean|unocha|ocha|topograph)/i.test(file);
}

function looksLikeCountryPhoto(file: string): boolean {
  if (looksMapLike(file)) return false;
  if (/\.svg$/i.test(file)) return false;
  if (/(?:flag|coat.of.arms|seal|emblem|logo|icon|chart|graph|diagram|climate|demograph|passport|stamp|satellite|world.wind|iss\d*|landsat|sentinel|modis|tmo)/i.test(file)) {
    return false;
  }
  return /\.(?:jpe?g|png|webp)$/i.test(file);
}

// Best-effort caption from a raw Wikimedia file name. Strips the
// extension and underscores, leaves the rest as-is — Commons file
// names are usually descriptive ("Eiffel_Tower_at_night.jpg").
function prettyCaptionFromFile(file: string, iso3: string): string {
  const base = file.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
  return base.length < 80 ? base : `${iso3} reference image`;
}
