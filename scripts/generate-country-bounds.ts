/**
 * generate-country-bounds.ts
 *
 * Builds a static per-country bounding-box + centroid lookup from the
 * Natural Earth 50m TopoJSON (`world-atlas/countries-50m.json`), so an
 * interactive map on each country page can be framed to the right region.
 *
 * Output: src/lib/data/country-bounds.generated.json
 *   { "PER": { "bbox": [W, S, E, N], "center": [lng, lat] }, ... }
 *   keyed by UPPERCASE ISO3, sorted alphabetically, 2-space pretty-print.
 *
 * Run: npx tsx scripts/generate-country-bounds.ts
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { feature } from "topojson-client";
import topo from "world-atlas/countries-50m.json";

// ISO 3166-1 numeric code -> our 3-letter country id (lowercase in source).
// Copied inline from src/components/atlas/map-geom.ts (:106) to keep this
// script free of any component/data-module side effects under tsx. We emit
// keys UPPERCASED to match the DB `jurisdictions.iso3` convention.
const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  "004": "afg", "008": "alb", "012": "dza", "020": "and", "024": "ago", "028": "atg", "032": "arg",
  "036": "aus", "040": "aut", "044": "bhs", "048": "bhr", "050": "bgd", "051": "arm", "052": "brb",
  "056": "bel", "064": "btn", "068": "bol", "070": "bih", "072": "bwa", "076": "bra", "084": "blz",
  "090": "slb", "096": "brn", "100": "bgr", "104": "mmr", "108": "bdi", "116": "khm", "120": "cmr",
  "124": "can", "140": "caf", "144": "lka", "148": "tcd", "152": "chl", "156": "chn", "170": "col",
  "174": "com", "178": "cog", "180": "cod", "188": "cri", "191": "hrv", "192": "cub", "196": "cyp",
  "203": "cze", "204": "ben", "208": "dnk", "214": "dom", "218": "ecu", "222": "slv", "226": "gnq",
  "231": "eth", "232": "eri", "233": "est", "242": "fji", "246": "fin", "250": "fra", "258": "pfu",
  "262": "dji", "266": "gab", "268": "geo", "270": "gmb", "275": "pse", "276": "deu", "288": "gha",
  "296": "kir", "300": "grc", "308": "grd", "320": "gtm", "324": "gin", "328": "guy", "332": "hti",
  "340": "hnd", "348": "hun", "352": "isl", "356": "ind", "360": "idn", "364": "irn", "368": "irq",
  "372": "irl", "376": "isr", "380": "ita", "384": "civ", "388": "jam", "392": "jpn", "398": "kaz",
  "400": "jor", "404": "ken", "408": "prk", "410": "kor", "414": "kwt", "417": "kgz", "418": "lao",
  "422": "lbn", "426": "lso", "428": "lva", "430": "lbr", "434": "lby", "440": "ltu", "442": "lux",
  "450": "mdg", "454": "mwi", "458": "mys", "462": "mdv", "466": "mli", "470": "mlt", "478": "mrt",
  "480": "mus", "484": "mex", "496": "mng", "498": "mda", "499": "mne", "504": "mar", "508": "moz",
  "512": "omn", "516": "nam", "520": "nru", "524": "npl", "528": "nld", "540": "ncl", "554": "nzl",
  "558": "nic", "562": "ner", "566": "nga", "578": "nor", "586": "pak", "591": "pan", "598": "png",
  "600": "pry", "604": "per", "608": "phl", "616": "pol", "620": "prt", "626": "tls", "634": "qat",
  "642": "rou", "643": "rus", "646": "rwa", "682": "sau", "686": "sen", "688": "srb", "694": "sle",
  "702": "sgp", "703": "svk", "704": "vnm", "705": "svn", "706": "som", "710": "zaf", "716": "zwe",
  "724": "esp", "728": "ssd", "729": "sdn", "740": "sur", "748": "swz", "752": "swe", "756": "che",
  "760": "syr", "762": "tjk", "764": "tha", "768": "tgo", "776": "ton", "780": "tto", "784": "are",
  "788": "tun", "792": "tur", "795": "tkm", "800": "uga", "804": "ukr", "807": "mkd", "818": "egy",
  "826": "gbr", "834": "tza", "840": "usa", "854": "bfa", "858": "ury", "860": "uzb", "862": "ven",
  "887": "yem", "894": "zmb",
};

interface Bounds {
  bbox: [number, number, number, number];
  center: [number, number];
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** Walk every [lng, lat] pair in an arbitrarily nested coordinate array. */
function eachCoord(coords: unknown, fn: (lng: number, lat: number) => void): void {
  if (!Array.isArray(coords)) return;
  // A coordinate pair is [number, number].
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    fn(coords[0] as number, coords[1] as number);
    return;
  }
  for (const inner of coords) eachCoord(inner, fn);
}

function main(): void {
  // topojson-client's `feature` returns a GeoJSON FeatureCollection when the
  // object is a GeometryCollection (as `countries` is). Its typed overloads
  // don't narrow to that here, so route the result through `unknown`.
  const fc = feature(
    topo as unknown as Parameters<typeof feature>[0],
    (topo as { objects: { countries: unknown } }).objects.countries as never,
  ) as unknown as {
    features: Array<{
      id?: string | number;
      geometry: { type: string; coordinates: unknown } | null;
    }>;
  };

  const out: Record<string, Bounds> = {};
  const unmapped: string[] = [];
  const wideBbox: Array<{ iso3: string; width: number }> = [];

  for (const f of fc.features) {
    if (f.id === undefined || f.id === null || !f.geometry) continue;
    const numeric = String(f.id).padStart(3, "0");
    const alpha3 = ISO_NUMERIC_TO_ALPHA3[numeric];
    if (!alpha3) {
      unmapped.push(numeric);
      continue;
    }
    const iso3 = alpha3.toUpperCase();

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    eachCoord(f.geometry.coordinates, (lng, lat) => {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
    if (!Number.isFinite(minLng)) continue;

    const width = maxLng - minLng;
    if (width > 180) {
      // Antimeridian-spanning country -> degenerate bbox (~-180..180).
      // Flag it so the SUPPLEMENT in country-bounds.ts can override with a
      // sensible mainland framing box. We still emit the raw bbox here; the
      // supplement wins at merge time.
      wideBbox.push({ iso3, width: round4(width) });
    }

    out[iso3] = {
      bbox: [round4(minLng), round4(minLat), round4(maxLng), round4(maxLat)],
      center: [round4((minLng + maxLng) / 2), round4((minLat + maxLat) / 2)],
    };
  }

  // Sort keys alphabetically.
  const sorted: Record<string, Bounds> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(here, "../src/lib/data/country-bounds.generated.json");
  writeFileSync(outPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  // Summary.
  console.log(`Emitted ${Object.keys(sorted).length} countries -> ${outPath}`);
  if (unmapped.length) {
    console.log(
      `Numeric ids with NO ISO3 mapping (skipped, ${unmapped.length}): ${[...new Set(unmapped)].sort().join(", ")}`,
    );
  }
  if (wideBbox.length) {
    console.log(
      `Countries with bbox width > 180 (antimeridian; supplement recommended):\n` +
        wideBbox
          .sort((a, b) => b.width - a.width)
          .map((w) => `  ${w.iso3}  width=${w.width}`)
          .join("\n"),
    );
  }
}

main();
