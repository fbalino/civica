"use client";

import {
  IndicatorTrendChart,
  type TrendSeriesInput,
} from "@/components/ci/IndicatorTrendChart";

/**
 * Design-system demo of <IndicatorTrendChart> with representative multi-series
 * data (a Germany-shaped trajectory across four source indicators). Client
 * component because the chart is interactive (series toggles + range control).
 *
 * Series are expanded to ANNUAL points from keyframes because that is the
 * real publication cadence the chart is built for — and the V-Dem series
 * keeps unified Germany's real 1944→1991 hole so the canonical demo shows
 * the gap-break behaviour (segments, never a line across the void).
 */

/** Keyframes → yearly points via linear interpolation (deterministic). */
function expand(
  keyframes: Array<[number, number]>,
  step = 1
): Array<{ year: number; value: number }> {
  const out: Array<{ year: number; value: number }> = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    const [y0, v0] = keyframes[i];
    const [y1, v1] = keyframes[i + 1];
    for (let y = y0; y < y1; y += step) {
      const t = (y - y0) / (y1 - y0);
      out.push({
        year: y,
        value: Math.round((v0 + (v1 - v0) * t) * 1000) / 1000,
      });
    }
  }
  const [yLast, vLast] = keyframes[keyframes.length - 1];
  out.push({ year: yLast, value: vLast });
  return out;
}

function makeSeries(): TrendSeriesInput[] {
  // Democratic quality (V-Dem, 0–1) — imperial rise, Weimar peak, collapse in
  // the 1930s; V-Dem codes 1945–1990 West Germany as a separate polity, so
  // the series resumes at reunification (the real 47-year gap).
  const vdem = [
    ...expand([
      [1900, 0.22],
      [1919, 0.55],
      [1932, 0.52],
      [1933, 0.06],
      [1944, 0.05],
    ]),
    ...expand([
      [1991, 0.84],
      [2005, 0.87],
      [2020, 0.82],
      [2025, 0.78],
    ]),
  ];
  // Rule of law (WGI, −2.5…+2.5) — biennial 1996–2002 (the real early
  // cadence, close enough to stay connected), annual after.
  const wgi = [
    ...expand(
      [
        [1996, 1.6],
        [2002, 1.69],
      ],
      2
    ),
    ...expand([
      [2002, 1.69],
      [2004, 1.72],
      [2012, 1.68],
      [2020, 1.62],
      [2024, 1.6],
    ]).slice(1),
  ];
  // Human development (HDI, 0–1) — steady climb.
  const hdi = expand([
    [1990, 0.8],
    [2000, 0.87],
    [2010, 0.92],
    [2020, 0.947],
    [2023, 0.95],
  ]);
  // Corruption control (CPI, 0–100) — high, slight recent dip.
  const cpi = expand([
    [2012, 79],
    [2016, 81],
    [2020, 80],
    [2024, 78],
  ]);

  return [
    {
      dimension: "democratic_quality",
      indicator: "v2x_libdem",
      sourceId: "vdem",
      sourceLabel: "V-Dem",
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
      points: vdem,
    },
    {
      dimension: "rule_of_law",
      indicator: "rl.est",
      sourceId: "worldbank_wgi",
      sourceLabel: "World Bank WGI",
      nativeMin: -2.5,
      nativeMax: 2.5,
      isInverted: false,
      points: wgi,
    },
    {
      dimension: "human_development",
      indicator: "hdi",
      sourceId: "undp_hdi",
      sourceLabel: "UNDP HDI",
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
      points: hdi,
    },
    {
      dimension: "corruption_control",
      indicator: "score",
      sourceId: "transparency_intl",
      sourceLabel: "Transparency International",
      nativeMin: 0,
      nativeMax: 100,
      isInverted: false,
      points: cpi,
    },
  ];
}

export function IndicatorTrendChartDemo() {
  return <IndicatorTrendChart series={makeSeries()} />;
}
