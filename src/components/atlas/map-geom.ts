// Pure projection + geometry helpers for the Atlas world map.
// Shared by AtlasWorldMap and the mini-map inside AtlasCountryLeft.

import type { Country } from "./data";

export const MAP_W = 2000;
export const MAP_H = 1000;
const LAT_MIN = -58;
const LAT_MAX = 85;

export function proj(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return [x, y];
}

type Geometry = {
  type: string;
  coordinates: number[][][][] | number[][][];
};

export function geomToPath(geom: Geometry): string {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  let d = "";
  for (const poly of rings) {
    for (const ring of poly) {
      const pts = ring as number[][];
      let prevLon: number | null = null;
      pts.forEach((pt, i) => {
        const lon = pt[0];
        const lat = pt[1];
        const [x, y] = proj(lon, lat);
        const crossesAntimeridian =
          prevLon !== null && Math.abs(lon - prevLon) > 180;
        if (i === 0 || crossesAntimeridian) {
          d += "M" + x.toFixed(1) + "," + y.toFixed(1);
        } else {
          d += "L" + x.toFixed(1) + "," + y.toFixed(1);
        }
        prevLon = lon;
      });
    }
  }
  return d;
}

export function geomCentroid(geom: Geometry): [number, number] {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  let best: number[][] | null = null;
  let bestArea = 0;
  for (const poly of rings) {
    const ring = poly[0] as number[][];
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    if (w * h > bestArea) {
      bestArea = w * h;
      best = ring;
    }
  }
  if (!best) return [0, 0];
  let sx = 0;
  let sy = 0;
  best.forEach((p) => {
    sx += p[0];
    sy += p[1];
  });
  return proj(sx / best.length, sy / best.length);
}

export function geomBBoxArea(geom: Geometry): number {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  let totalArea = 0;
  for (const poly of rings) {
    const ring = poly[0] as number[][];
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const w = Math.max(...lons) - Math.min(...lons);
    const h = Math.max(...lats) - Math.min(...lats);
    totalArea += w * h;
  }
  return totalArea;
}

export interface MapPath {
  d: string;
  id: string | null;
  country: Country | null;
  neId: string;
  centroid: [number, number];
  area: number;
}

// ISO 3166-1 numeric code → our 3-letter country id. Used to link
// world-atlas TopoJSON features (keyed by numeric) to our DB records.
export const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  "004":"afg","008":"alb","012":"dza","020":"and","024":"ago","028":"atg","032":"arg",
  "036":"aus","040":"aut","044":"bhs","048":"bhr","050":"bgd","051":"arm","052":"brb",
  "056":"bel","064":"btn","068":"bol","070":"bih","072":"bwa","076":"bra","084":"blz",
  "090":"slb","096":"brn","100":"bgr","104":"mmr","108":"bdi","116":"khm","120":"cmr",
  "124":"can","140":"caf","144":"lka","148":"tcd","152":"chl","156":"chn","170":"col",
  "174":"com","178":"cog","180":"cod","188":"cri","191":"hrv","192":"cub","196":"cyp",
  "203":"cze","204":"ben","208":"dnk","214":"dom","218":"ecu","222":"slv","226":"gnq",
  "231":"eth","232":"eri","233":"est","242":"fji","246":"fin","250":"fra","258":"pfu",
  "262":"dji","266":"gab","268":"geo","270":"gmb","275":"pse","276":"deu","288":"gha",
  "296":"kir","300":"grc","308":"grd","320":"gtm","324":"gin","328":"guy","332":"hti",
  "340":"hnd","348":"hun","352":"isl","356":"ind","360":"idn","364":"irn","368":"irq",
  "372":"irl","376":"isr","380":"ita","384":"civ","388":"jam","392":"jpn","398":"kaz",
  "400":"jor","404":"ken","408":"prk","410":"kor","414":"kwt","417":"kgz","418":"lao",
  "422":"lbn","426":"lso","428":"lva","430":"lbr","434":"lby","440":"ltu","442":"lux",
  "450":"mdg","454":"mwi","458":"mys","462":"mdv","466":"mli","470":"mlt","478":"mrt",
  "480":"mus","484":"mex","496":"mng","498":"mda","499":"mne","504":"mar","508":"moz",
  "512":"omn","516":"nam","520":"nru","524":"npl","528":"nld","540":"ncl","554":"nzl",
  "558":"nic","562":"ner","566":"nga","578":"nor","586":"pak","591":"pan","598":"png",
  "600":"pry","604":"per","608":"phl","616":"pol","620":"prt","626":"tls","634":"qat",
  "642":"rou","643":"rus","646":"rwa","682":"sau","686":"sen","688":"srb","694":"sle",
  "702":"sgp","703":"svk","704":"vnm","705":"svn","706":"som","710":"zaf","716":"zwe",
  "724":"esp","728":"ssd","729":"sdn","740":"sur","748":"swz","752":"swe","756":"che",
  "760":"syr","762":"tjk","764":"tha","768":"tgo","776":"ton","780":"tto","784":"are",
  "788":"tun","792":"tur","795":"tkm","800":"uga","804":"ukr","807":"mkd","818":"egy",
  "826":"gbr","834":"tza","840":"usa","854":"bfa","858":"ury","860":"uzb","862":"ven",
  "887":"yem","894":"zmb",
};

/** Map numeric IDs only for countries we actually know about. */
export function buildNeIdMap(
  countries: readonly { id: string }[],
): Record<string, string> {
  const countryIds = new Set(countries.map((c) => c.id));
  const map: Record<string, string> = {};
  for (const [numericId, alpha3] of Object.entries(ISO_NUMERIC_TO_ALPHA3)) {
    if (countryIds.has(alpha3)) map[numericId] = alpha3;
  }
  return map;
}
