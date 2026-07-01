import generated from "./country-bounds.generated.json";

export interface CountryBounds {
  bbox: [number, number, number, number];
  center: [number, number];
}

// Hand-authored entries for countries missing from / broken in the 50m TopoJSON
// (microstates absent at 50m; antimeridian-spanning countries with degenerate
// bboxes). Values are approximate mainland framing boxes [W, S, E, N] with a
// matching center. Overrides the generated bbox at merge time.
const SUPPLEMENT: Record<string, CountryBounds> = {
  // --- Antimeridian-spanning: 50m bbox is degenerate (~-180..180) ---
  RUS: { bbox: [27.3, 41.2, 180.0, 77.0], center: [96.0, 61.5] }, // mainland Eurasia framing
  USA: { bbox: [-125.0, 24.5, -66.9, 49.4], center: [-98.5, 39.5] }, // contiguous 48 states
  FJI: { bbox: [176.8, -19.2, 180.0, -16.0], center: [178.4, -17.7] }, // main Viti Levu / Vanua Levu
  NZL: { bbox: [166.4, -47.3, 178.6, -34.4], center: [172.5, -41.0] }, // North + South Island
  KIR: { bbox: [172.9, 1.3, 173.2, 1.5], center: [173.0, 1.4] }, // Tarawa (capital atoll)
  // Natural Earth's FRA includes overseas départements (French Guiana ~-61°W,
  // Réunion ~55°E), so the generated bbox spans a whole hemisphere. Frame on
  // metropolitan France instead.
  FRA: { bbox: [-5.14, 41.33, 9.56, 51.09], center: [2.2, 46.6] },

  // --- Microstates / small island states absent at 50m resolution ---
  SGP: { bbox: [103.6, 1.15, 104.1, 1.48], center: [103.82, 1.35] },
  MCO: { bbox: [7.38, 43.72, 7.44, 43.76], center: [7.41, 43.74] },
  VAT: { bbox: [12.44, 41.9, 12.46, 41.91], center: [12.45, 41.9] },
  SMR: { bbox: [12.4, 43.89, 12.52, 43.99], center: [12.46, 43.94] },
  LIE: { bbox: [9.47, 47.05, 9.64, 47.27], center: [9.55, 47.16] },
  AND: { bbox: [1.41, 42.43, 1.79, 42.66], center: [1.6, 42.55] },
  MLT: { bbox: [14.18, 35.79, 14.58, 36.09], center: [14.38, 35.94] },
  BHR: { bbox: [50.38, 25.79, 50.66, 26.29], center: [50.55, 26.03] },
  MHL: { bbox: [165.3, 5.6, 172.0, 11.7], center: [168.7, 7.1] },
  TUV: { bbox: [176.0, -10.8, 179.9, -5.6], center: [178.7, -8.0] },
  NRU: { bbox: [166.9, -0.55, 166.96, -0.5], center: [166.92, -0.52] },
  SYC: { bbox: [55.2, -4.8, 55.9, -4.3], center: [55.49, -4.62] },
  MDV: { bbox: [72.6, -0.7, 73.7, 7.1], center: [73.2, 3.2] },
  PLW: { bbox: [131.1, 6.9, 134.7, 8.1], center: [134.5, 7.5] },
  FSM: { bbox: [138.0, 5.2, 163.1, 10.1], center: [150.5, 6.9] },
  WSM: { bbox: [-172.8, -14.1, -171.4, -13.4], center: [-172.1, -13.76] },
  TON: { bbox: [-175.4, -21.5, -173.7, -18.5], center: [-174.8, -20.5] },
  KNA: { bbox: [-62.9, 17.09, -62.5, 17.42], center: [-62.75, 17.29] },
  ATG: { bbox: [-61.9, 16.99, -61.66, 17.73], center: [-61.79, 17.28] },
  DMA: { bbox: [-61.5, 15.2, -61.24, 15.64], center: [-61.37, 15.42] },
  LCA: { bbox: [-61.08, 13.7, -60.87, 14.11], center: [-60.98, 13.9] },
  VCT: { bbox: [-61.46, 12.98, -61.11, 13.38], center: [-61.2, 13.25] },
  GRD: { bbox: [-61.8, 11.99, -61.6, 12.32], center: [-61.68, 12.12] },
  BRB: { bbox: [-59.66, 13.04, -59.42, 13.34], center: [-59.54, 13.19] },
  STP: { bbox: [6.44, 0.02, 7.47, 1.72], center: [6.61, 0.25] },
  COM: { bbox: [43.2, -12.42, 44.54, -11.36], center: [43.87, -11.65] },
  CPV: { bbox: [-25.36, 14.8, -22.66, 17.2], center: [-23.6, 16.0] },

  // --- Present in the 50m TopoJSON, but their ISO numeric code is not in the
  // ISO_NUMERIC_TO_ALPHA3 map, so the generator skipped them. Hand-authored ---
  AZE: { bbox: [44.79, 38.39, 50.37, 41.9], center: [47.58, 40.14] },
  BLR: { bbox: [23.18, 51.26, 32.77, 56.17], center: [27.95, 53.71] },
  GNB: { bbox: [-16.72, 10.86, -13.64, 12.68], center: [-15.18, 11.8] },
  VUT: { bbox: [166.5, -20.25, 170.24, -13.07], center: [167.68, -16.6] },
  TWN: { bbox: [120.03, 21.9, 122.0, 25.3], center: [120.96, 23.7] },
  XKS: { bbox: [20.01, 41.86, 21.79, 43.27], center: [20.9, 42.57] },
};

const BOUNDS: Record<string, CountryBounds> = {
  ...(generated as unknown as Record<string, CountryBounds>),
  ...SUPPLEMENT,
};

export function getCountryBounds(
  iso3: string | null | undefined,
): CountryBounds | null {
  if (!iso3) return null;
  return BOUNDS[iso3.toUpperCase()] ?? null;
}
