import assert from "node:assert/strict";
import { test } from "node:test";

import AdmZip from "adm-zip";

import {
  CI_PRODUCTION_SOURCE_URLS,
  applyFrozenReleaseCoverage,
  parseFreedomHouse,
  parseTransparencyCpi,
  parseVdemCore,
  parseWgiRuleOfLaw,
  parseWgiVoiceAccountability,
  wgiFallbackRecords,
} from "../production-source-adapters";
import releaseCoverage from "../production-release-coverage.generated.json";
import { getNormalizationTableRows } from "../normalization-table";

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number): string {
  let value = index + 1;
  let out = "";
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

function workbook(
  sheets: Record<string, readonly (readonly string[])[]>,
): Buffer {
  const zip = new AdmZip();
  const names = Object.keys(sheets);
  zip.addFile(
    "xl/workbook.xml",
    Buffer.from(
      `<workbook><sheets>${names
        .map(
          (name, index) =>
            `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ),
  );
  zip.addFile(
    "xl/_rels/workbook.xml.rels",
    Buffer.from(
      `<Relationships>${names
        .map(
          (_name, index) =>
            `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
  );
  names.forEach((name, sheetIndex) => {
    const rows = sheets[name]
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">${row
            .map(
              (cell, columnIndex) =>
                `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`,
            )
            .join("")}</row>`,
      )
      .join("");
    zip.addFile(
      `xl/worksheets/sheet${sheetIndex + 1}.xml`,
      Buffer.from(`<worksheet><sheetData>${rows}</sheetData></worksheet>`),
    );
  });
  return zip.toBuffer();
}

test("V-Dem parser selects the declared year and normalizes ISO3 exceptions", () => {
  const zip = new AdmZip();
  zip.addFile(
    "V-Dem-CY-Core-v15.csv",
    Buffer.from(
      [
        "country_text_id,year,v2x_libdem",
        "DNK,2023,0.88",
        "DNK,2024,0.883",
        "ADO,2024,0.51",
      ].join("\n"),
    ),
  );
  const result = parseVdemCore(zip.toBuffer(), 2024);
  assert.deepEqual(
    result.records.map((row) => [row.iso3, row.rawValue]),
    [
      ["DNK", 0.883],
      ["AND", 0.51],
    ],
  );
  assert.equal(result.globalMinObserved, 0.51);
  assert.equal(result.globalMaxObserved, 0.883);
});

test("WGI parser keeps Rule of Law and Voice & Accountability distinct", () => {
  const header = [
    "Economy (code)",
    "Year",
    "Governance estimate (approx. -2.5 to +2.5)",
  ];
  const bytes = workbook({
    rl: [header, ["DNK", "2024", "2.01"], ["DNK", "2023", "1.99"]],
    va: [header, ["DNK", "2024", "1.44"], ["SSD", "2024", "-1.8"]],
  });
  const rule = parseWgiRuleOfLaw(bytes, 2024);
  const voice = parseWgiVoiceAccountability(bytes, 2024);
  assert.deepEqual(
    rule.records.map((row) => row.indicator),
    ["rl.est"],
  );
  assert.deepEqual(
    voice.records.map((row) => [row.iso3, row.indicator, row.rawValue]),
    [
      ["DNK", "va.est", 1.44],
      ["SSD", "va.est", -1.8],
    ],
  );
});

test("Freedom House parser sums PR+CL, rejects territories, and names unmatched countries", () => {
  const bytes = workbook({
    "FIW06-24": [
      ["Country/Territory", "Edition", "C/T?", "PR Rating", "CL Rating"],
      ["Testland", "2024", "c", "2", "3"],
      ["Test Territory", "2024", "t", "4", "5"],
      ["Unknown Republic", "2024", "c", "6", "7"],
    ],
  });
  const parsed = parseFreedomHouse(bytes, new Map([["testland", "TST"]]), 2024);
  assert.deepEqual(
    parsed.ingestion.records.map((row) => [row.iso3, row.rawValue]),
    [["TST", 5]],
  );
  assert.deepEqual(parsed.unmatchedCountryNames, ["Unknown Republic"]);
});

test("Transparency parser selects the matching edition sheet and score column", () => {
  const bytes = workbook({
    "CPI 2024": [
      ["ISO3", "CPI 2024 score"],
      ["DNK", "90"],
      ["SOM", "11"],
    ],
  });
  const result = parseTransparencyCpi(bytes, 2024);
  assert.deepEqual(
    result.records.map((row) => [row.iso3, row.rawValue]),
    [
      ["DNK", 90],
      ["SOM", 11],
    ],
  );
});

test("WGI fallback remains explicitly WGI and excludes V-Dem-covered ISO3s", () => {
  const header = [
    "Economy (code)",
    "Year",
    "Governance estimate (approx. -2.5 to +2.5)",
  ];
  const voice = parseWgiVoiceAccountability(
    workbook({
      va: [header, ["DNK", "2024", "1.44"], ["SSD", "2024", "-1.8"]],
    }),
    2024,
  );
  const fallback = wgiFallbackRecords(voice, new Set(["DNK"]));
  assert.equal(fallback.sourceId, "worldbank_wgi");
  assert.equal(fallback.dimension, "democratic_quality");
  assert.deepEqual(
    fallback.records.map((row) => row.iso3),
    ["SSD"],
  );
});

test("canonical download URLs are official HTTPS publisher locations", () => {
  assert.match(CI_PRODUCTION_SOURCE_URLS.vdem, /^https:\/\/www\.v-dem\.net\//);
  assert.match(
    CI_PRODUCTION_SOURCE_URLS.worldbankWgi,
    /^https:\/\/www\.worldbank\.org\//,
  );
  assert.match(
    CI_PRODUCTION_SOURCE_URLS.freedomHouse,
    /^https:\/\/freedomhouse\.org\//,
  );
  assert.match(
    CI_PRODUCTION_SOURCE_URLS.transparencyCpi,
    /^https:\/\/images\.transparencycdn\.org\//,
  );
});

test("the frozen 2024-Q4 coverage manifest closes all five deployed source paths", () => {
  assert.equal(releaseCoverage.releaseId, "ci-beta-2024-Q4");
  assert.deepEqual(Object.keys(releaseCoverage.groups), [
    "vdem.democratic_quality",
    "worldbank_wgi.democratic_quality_fallback",
    "worldbank_wgi.rule_of_law",
    "freedom_house.freedom_rights",
    "transparency_intl.corruption_control",
  ]);
  assert.equal(
    Object.values(releaseCoverage.groups).reduce(
      (total, group) => total + group.expectedRows,
      0,
    ),
    745,
  );
  for (const hash of [
    ...Object.values(releaseCoverage.inputSha256),
    ...Object.values(releaseCoverage.groups).map(
      (group) => group.semanticSha256,
    ),
  ]) {
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
});

test("frozen release coverage applies only to its named dataset year", () => {
  const base = {
    sourceId: "vdem",
    dimension: "democratic_quality" as const,
    datasetYear: 2024,
    globalMinObserved: 0.2,
    globalMaxObserved: 0.8,
    records: [
      {
        iso3: "USA",
        year: 2024,
        dimension: "democratic_quality" as const,
        indicator: "v2x_libdem",
        rawValue: 0.8,
        nativeMin: 0,
        nativeMax: 1,
        isInverted: false,
      },
      {
        iso3: "ARE",
        year: 2024,
        dimension: "democratic_quality" as const,
        indicator: "v2x_libdem",
        rawValue: 0.2,
        nativeMin: 0,
        nativeMax: 1,
        isInverted: false,
      },
    ],
  };
  assert.deepEqual(
    applyFrozenReleaseCoverage(base, "vdem.democratic_quality").records.map(
      (row) => row.iso3,
    ),
    ["USA"],
  );
  const future = {
    ...base,
    datasetYear: 2025,
    records: base.records.map((row) => ({ ...row, year: 2025 })),
  };
  assert.equal(
    applyFrozenReleaseCoverage(future, "vdem.democratic_quality").records
      .length,
    2,
  );
});

test("public normalization rows disclose the deployed WGI coverage fallback", () => {
  const rows = getNormalizationTableRows();
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((row) => [row.dimensionLabel, row.sourceLabel]),
    [
      ["Democratic quality", "V-Dem Liberal Democracy Index"],
      [
        "Democratic quality (coverage fallback)",
        "World Bank WGI Voice & Accountability",
      ],
      ["Rule of law", "World Bank WGI Rule of Law"],
      ["Freedoms & rights", "Freedom House (PR + CL, combined)"],
      ["Corruption control", "Transparency International CPI"],
    ],
  );
});
