"use client";

import {
  IndicatorTrendChart,
  type TrendSeriesInput,
} from "@/components/ci/IndicatorTrendChart";

/**
 * Design-system demo of <IndicatorTrendChart> with representative multi-series
 * data (a Germany-shaped trajectory across four source indicators). Client
 * component because the chart is interactive (series toggles + range control).
 */

function makeSeries(): TrendSeriesInput[] {
  // Democratic quality (V-Dem, 0–1) — collapse in the 1930s, post-war recovery.
  const vdem: Array<[number, number]> = [
    [1900, 0.22],
    [1919, 0.55],
    [1933, 0.06],
    [1949, 0.62],
    [1970, 0.78],
    [1990, 0.84],
    [2005, 0.87],
    [2020, 0.82],
    [2025, 0.78],
  ];
  // Rule of law (WGI, −2.5…+2.5) — steady, high.
  const wgi: Array<[number, number]> = [
    [1996, 1.6],
    [2004, 1.72],
    [2012, 1.68],
    [2020, 1.62],
    [2024, 1.6],
  ];
  // Human development (HDI, 0–1) — steady climb.
  const hdi: Array<[number, number]> = [
    [1990, 0.8],
    [2000, 0.87],
    [2010, 0.92],
    [2020, 0.947],
    [2023, 0.95],
  ];
  // Corruption control (CPI, 0–100) — high, slight recent dip.
  const cpi: Array<[number, number]> = [
    [2012, 79],
    [2016, 81],
    [2020, 80],
    [2024, 78],
  ];

  const toPoints = (rows: Array<[number, number]>) =>
    rows.map(([year, value]) => ({ year, value }));

  return [
    {
      dimension: "democratic_quality",
      indicator: "v2x_libdem",
      sourceId: "vdem",
      sourceLabel: "V-Dem",
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
      points: toPoints(vdem),
    },
    {
      dimension: "rule_of_law",
      indicator: "rl.est",
      sourceId: "worldbank_wgi",
      sourceLabel: "World Bank WGI",
      nativeMin: -2.5,
      nativeMax: 2.5,
      isInverted: false,
      points: toPoints(wgi),
    },
    {
      dimension: "human_development",
      indicator: "hdi",
      sourceId: "undp_hdi",
      sourceLabel: "UNDP HDI",
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
      points: toPoints(hdi),
    },
    {
      dimension: "corruption_control",
      indicator: "score",
      sourceId: "transparency_intl",
      sourceLabel: "Transparency International",
      nativeMin: 0,
      nativeMax: 100,
      isInverted: false,
      points: toPoints(cpi),
    },
  ];
}

export function IndicatorTrendChartDemo() {
  return <IndicatorTrendChart series={makeSeries()} />;
}
