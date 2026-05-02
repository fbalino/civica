import AdmZip from "adm-zip";
import { sql as dsql } from "drizzle-orm";
import { jurisdictions } from "../db/schema";
import type { Db } from "./ingest";

export const DEFAULT_CI_DATASET_YEAR = Number(
  process.env.CI_DATASET_YEAR ?? "2024",
);

export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "civica-ci-sync/1.0 (https://civicaatlas.org)",
    },
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.status} ${res.statusText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export function zipEntryText(
  buffer: Buffer,
  predicate: (entryName: string) => boolean,
): string {
  const zip = new AdmZip(buffer);
  const entry = zip
    .getEntries()
    .find((candidate) => predicate(candidate.entryName));

  if (!entry) {
    throw new Error("Could not find expected file inside archive.");
  }

  return entry.getData().toString("utf-8");
}

export function forEachCsvRow(
  text: string,
  onRow: (row: string[], rowIndex: number) => void,
): void {
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let rowIndex = 0;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    pushCell();
    onRow(row, rowIndex);
    row = [];
    rowIndex++;
  };

  for (; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          cell += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    pushRow();
  }
}

export function csvObjects(
  text: string,
  headerPredicate: (row: string[]) => boolean,
): Record<string, string>[] {
  let headers: string[] | null = null;
  const out: Record<string, string>[] = [];

  forEachCsvRow(text, (row) => {
    if (!headers) {
      if (headerPredicate(row)) {
        headers = row.map((h) => h.trim());
      }
      return;
    }

    if (row.every((cell) => cell.trim() === "")) return;

    const object: Record<string, string> = {};
    headers.forEach((header, i) => {
      object[header] = row[i]?.trim() ?? "";
    });
    out.push(object);
  });

  if (!headers) {
    throw new Error("CSV header row was not found.");
  }

  return out;
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function xlsxSheetRows(buffer: Buffer, sheetName: string): string[][] {
  const zip = new AdmZip(buffer);
  const text = (path: string) => {
    const entry = zip.getEntry(path);
    if (!entry) throw new Error(`Missing XLSX entry: ${path}`);
    return entry.getData().toString("utf-8");
  };

  const workbook = text("xl/workbook.xml");
  const rels = text("xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(zip);
  const sheets = parseWorkbookSheets(workbook);
  const relTargets = parseWorkbookRelationships(rels);
  const sheet = sheets.find((s) => s.name === sheetName);

  if (!sheet) {
    throw new Error(`Could not find XLSX sheet "${sheetName}".`);
  }

  const target = relTargets.get(sheet.relationshipId);
  if (!target) {
    throw new Error(`Could not resolve XLSX sheet target for "${sheetName}".`);
  }

  const sheetPath = target.startsWith("/")
    ? target.replace(/^\/xl\//, "xl/")
    : `xl/${target}`;
  const xml = text(sheetPath);
  const rows: string[][] = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowCells: string[] = [];
    const rowXml = rowMatch[1];

    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = parseAttributes(cellMatch[1]);
      const ref = attrs.get("r");
      const index = ref ? columnIndex(ref) : rowCells.length;
      rowCells[index] = readCellValue(cellMatch[2], attrs, sharedStrings);
    }

    rows.push(rowCells.map((cell) => cell ?? ""));
  }

  return rows;
}

export function rowsToObjects(
  rows: string[][],
  headerPredicate: (row: string[]) => boolean,
): Record<string, string>[] {
  const headerIndex = rows.findIndex(headerPredicate);
  if (headerIndex === -1) {
    throw new Error("Spreadsheet header row was not found.");
  }

  const headers = rows[headerIndex].map((h) => h.trim());
  return rows.slice(headerIndex + 1).flatMap((row) => {
    if (row.every((cell) => !cell || cell.trim() === "")) return [];
    const object: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) object[header] = row[i]?.trim() ?? "";
    });
    return [object];
  });
}

export function minMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    throw new Error("Cannot calculate min/max for an empty values array.");
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function normalizeCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bthe\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function normalizeIso3Code(code: string): string {
  const normalized = code.trim().toUpperCase();
  return ISO3_CODE_OVERRIDES[normalized] ?? normalized;
}

export async function buildIso3ByCountryName(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({ name: jurisdictions.name, iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(dsql`${jurisdictions.iso3} IS NOT NULL`);

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.iso3) map.set(normalizeCountryName(row.name), row.iso3);
  }

  for (const [name, iso3] of Object.entries(COUNTRY_NAME_TO_ISO3)) {
    map.set(normalizeCountryName(name), iso3);
  }

  return map;
}

function parseWorkbookSheets(xml: string): { name: string; relationshipId: string }[] {
  const sheets: { name: string; relationshipId: string }[] = [];
  for (const match of xml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    const name = attrs.get("name");
    const relationshipId = attrs.get("r:id");
    if (name && relationshipId) sheets.push({ name, relationshipId });
  }
  return sheets;
}

function parseWorkbookRelationships(xml: string): Map<string, string> {
  const rels = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    const id = attrs.get("Id");
    const target = attrs.get("Target");
    if (id && target) rels.set(id, target);
  }
  return rels;
}

function parseSharedStrings(zip: AdmZip): string[] {
  const entry = zip.getEntry("xl/sharedStrings.xml");
  if (!entry) return [];

  const xml = entry.getData().toString("utf-8");
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(
      (part) => decodeXml(part[1]),
    );
    strings.push(parts.join(""));
  }
  return strings;
}

function parseAttributes(input: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of input.matchAll(/([\w:]+)="([^"]*)"/g)) {
    attrs.set(match[1], decodeXml(match[2]));
  }
  return attrs;
}

function readCellValue(
  xml: string,
  attrs: Map<string, string>,
  sharedStrings: string[],
): string {
  const type = attrs.get("t");

  if (type === "inlineStr") {
    const text = [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
    return text;
  }

  const value = xml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (type === "s") {
    return sharedStrings[Number(value)] ?? "";
  }
  return decodeXml(value);
}

function columnIndex(cellRef: string): number {
  const letters = cellRef.match(/[A-Z]+/)?.[0] ?? "";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const COUNTRY_NAME_TO_ISO3: Record<string, string> = {
  Bahamas: "BHS",
  "The Bahamas": "BHS",
  Bolivia: "BOL",
  "Bolivia (Plurinational State of)": "BOL",
  Brunei: "BRN",
  "Brunei Darussalam": "BRN",
  "Cabo Verde": "CPV",
  "Cape Verde": "CPV",
  "Central African Republic": "CAF",
  "Congo (Brazzaville)": "COG",
  "Republic of Congo": "COG",
  "Republic of the Congo": "COG",
  "Congo (Kinshasa)": "COD",
  "Democratic Republic of Congo": "COD",
  "Democratic Republic of the Congo": "COD",
  "Cote d'Ivoire": "CIV",
  "Côte d'Ivoire": "CIV",
  Czechia: "CZE",
  "Czech Republic": "CZE",
  "Dominican Republic": "DOM",
  Gambia: "GMB",
  "The Gambia": "GMB",
  Iran: "IRN",
  "Iran, Islamic Republic of": "IRN",
  Israel: "ISR",
  "Korea, North": "PRK",
  "North Korea": "PRK",
  "Korea, South": "KOR",
  "South Korea": "KOR",
  Kyrgyzstan: "KGZ",
  "Kyrgyz Republic": "KGZ",
  Laos: "LAO",
  "Lao People's Democratic Republic": "LAO",
  Micronesia: "FSM",
  "Federated States of Micronesia": "FSM",
  Moldova: "MDA",
  "Republic of Moldova": "MDA",
  Myanmar: "MMR",
  Burma: "MMR",
  Russia: "RUS",
  "Russian Federation": "RUS",
  "Sao Tome and Principe": "STP",
  "São Tomé and Príncipe": "STP",
  Slovakia: "SVK",
  "Slovak Republic": "SVK",
  "St. Kitts and Nevis": "KNA",
  "Saint Kitts and Nevis": "KNA",
  "St. Lucia": "LCA",
  "Saint Lucia": "LCA",
  "St. Vincent and the Grenadines": "VCT",
  "Saint Vincent and the Grenadines": "VCT",
  Swaziland: "SWZ",
  Eswatini: "SWZ",
  Syria: "SYR",
  "Syrian Arab Republic": "SYR",
  Tanzania: "TZA",
  "United Republic of Tanzania": "TZA",
  Turkey: "TUR",
  Türkiye: "TUR",
  Venezuela: "VEN",
  "Venezuela, Bolivarian Republic of": "VEN",
  Vietnam: "VNM",
  "Viet Nam": "VNM",
  "United States": "USA",
  "United States of America": "USA",
  "United Arab Emirates": "ARE",
};

const ISO3_CODE_OVERRIDES: Record<string, string> = {
  ADO: "AND",
};
