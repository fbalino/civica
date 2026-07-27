/**
 * Outcomes data-fetch types + reducer, extracted from
 * `CountryOutcomeBars.tsx` (QA-002) so the pure state-transition logic is
 * unit-testable with `node --test` directly. `CountryOutcomeBars.tsx` is a
 * "use client" component that imports a CSS Module
 * (`./CountryOutcomeBars.module.css`); Node's native test runner has no
 * bundler and cannot resolve that import, so anything defined inside that
 * file is untestable in isolation. Moving the reducer (and the types it
 * depends on) here — with zero React/CSS dependencies — makes it
 * importable on its own. `CountryOutcomeBars.tsx` re-exports
 * `outcomesReducer` and its state/action types from this module, so it
 * still satisfies "export outcomesReducer from CountryOutcomeBars.tsx"
 * for any existing caller. No logic changed — every branch below is
 * byte-for-byte the same as the code this replaces.
 */

export interface PeerStats {
  metricId: string;
  peerCount: number;
  peerMin: number;
  peerMedian: number;
  peerMax: number;
}

export interface MetricRow {
  metricId: string;
  name: string;
  category: string;
  unit: string | null;
  higherIsBetter: boolean;
  value: number;
  asOfYear: number;
  rank: number | null;
  totalRanked: number | null;
  isStale: boolean;
  peer: PeerStats | null;
}

export interface OutcomesPayload {
  countryId: string;
  countrySlug: string;
  countryName: string;
  govType: string | null;
  year: number;
  metrics: MetricRow[];
}

export type OutcomesState = {
  data: OutcomesPayload | null;
  loading: boolean;
  error: string | null;
};

export type OutcomesAction =
  | { type: "start" }
  | { type: "success"; payload: OutcomesPayload }
  | { type: "error"; message: string };

export function outcomesReducer(
  state: OutcomesState,
  action: OutcomesAction,
): OutcomesState {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "success":
      return { data: action.payload, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: action.message };
  }
}
