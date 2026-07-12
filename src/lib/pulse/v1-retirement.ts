import { NextResponse } from "next/server";

export type PulseV1Stage = "ingest" | "classify" | "calculate";

type PulseV1Retirement = Readonly<{
  legacyStep: `pulse.${PulseV1Stage}`;
  successor: `/api/cron/pulse/v2/${"ingest" | "classify" | "score"}`;
}>;

export const PULSE_V1_RETIREMENT_CODE = "pulse_v1_pipeline_retired" as const;
export const PULSE_V1_RETIREMENT_DOCUMENTATION =
  "/civica-index/methodology/pulse" as const;

export const PULSE_V1_RETIREMENTS: Readonly<
  Record<PulseV1Stage, PulseV1Retirement>
> = Object.freeze({
  ingest: Object.freeze({
    legacyStep: "pulse.ingest",
    successor: "/api/cron/pulse/v2/ingest",
  }),
  classify: Object.freeze({
    legacyStep: "pulse.classify",
    successor: "/api/cron/pulse/v2/classify",
  }),
  calculate: Object.freeze({
    legacyStep: "pulse.calculate",
    successor: "/api/cron/pulse/v2/score",
  }),
});

export function pulseV1RetirementMessage(stage: PulseV1Stage): string {
  const retirement = PULSE_V1_RETIREMENTS[stage];
  return `${retirement.legacyStep} is retired; use ${retirement.successor}.`;
}

/**
 * Terminal response for the abandoned Pulse v1 operational pipeline.
 * Callers must authenticate before invoking this helper so the old cron
 * endpoints retain their fail-closed boundary.
 */
export function retiredPulseV1CronResponse(stage: PulseV1Stage): NextResponse {
  const retirement = PULSE_V1_RETIREMENTS[stage];
  return NextResponse.json(
    {
      ok: false,
      code: PULSE_V1_RETIREMENT_CODE,
      error: pulseV1RetirementMessage(stage),
      step: retirement.legacyStep,
      disposition: "retired",
      successor: retirement.successor,
      documentation: PULSE_V1_RETIREMENT_DOCUMENTATION,
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        Deprecation: "true",
        Link: `<${retirement.successor}>; rel="successor-version", <${PULSE_V1_RETIREMENT_DOCUMENTATION}>; rel="deprecation"`,
      },
    },
  );
}
