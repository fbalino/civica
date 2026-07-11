import { CURRENT_PULSE_RUNTIME_METHOD } from "./runtime-contract";

export const PULSE_NUMERIC_PUBLICATION_MODES = [
  "omit",
  "api_only_experimental",
] as const;

export type PulseNumericPublicationMode =
  (typeof PULSE_NUMERIC_PUBLICATION_MODES)[number];

export interface PulseNumericPublicationPolicy {
  id: string;
  mode: PulseNumericPublicationMode;
  methodVersion: string;
  publicStatus: "omitted_pending_validation" | "public_experimental";
  label: "Not publicly displayed" | "Experimental heuristic";
  surfaces: {
    ui: boolean;
    api: boolean;
    bulkExport: false;
  };
  limitations: readonly string[];
  reconsiderationGate: string;
}

const LIMITATIONS = [
  "Not a validated measure of governance change.",
  "Not comparable across countries as a score or ranking.",
  "Coverage, calibration, and independent review remain incomplete.",
] as const;

/**
 * Pure policy builder used by the current contract and by the two required
 * PUL-001 policy snapshots. Numeric rows remain in the research database in
 * either mode; this function governs only their public presentation.
 */
export function buildPulseNumericPublicationPolicy(
  mode: PulseNumericPublicationMode,
  methodVersion: string,
): PulseNumericPublicationPolicy {
  if (mode === "omit") {
    return Object.freeze({
      id: "pulse-numeric-publication/omit-v1",
      mode,
      methodVersion,
      publicStatus: "omitted_pending_validation",
      label: "Not publicly displayed",
      surfaces: Object.freeze({ ui: false, api: false, bulkExport: false }),
      limitations: LIMITATIONS,
      reconsiderationGate:
        "A new versioned policy may expose numeric effects only after the Pulse validation and disposition gates are resolved.",
    });
  }

  return Object.freeze({
    id: "pulse-numeric-publication/api-only-experimental-v1",
    mode,
    methodVersion,
    publicStatus: "public_experimental",
    label: "Experimental heuristic",
    surfaces: Object.freeze({ ui: false, api: true, bulkExport: false }),
    limitations: LIMITATIONS,
    reconsiderationGate:
      "No stronger measurement, comparison, or validation claim is permitted before the Pulse validation and disposition gates are resolved.",
  });
}

export const CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY =
  buildPulseNumericPublicationPolicy(
    "api_only_experimental",
    CURRENT_PULSE_RUNTIME_METHOD.version,
  );
