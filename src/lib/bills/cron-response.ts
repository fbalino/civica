import { NextResponse } from "next/server";

import { BillSourceAggregateError, type RunBillsSyncSummary } from "./sync";

/**
 * Preserve the cron boundary's closed error contract while exposing safe,
 * actionable bill-source failures to the durable retry scheduler. Unknown
 * exceptions are rethrown for the shared handler_exception boundary.
 */
export async function billsCronResponse(
  step: string,
  run: () => Promise<RunBillsSyncSummary>,
): Promise<Response> {
  const started = new Date().toISOString();
  try {
    const summary = await run();
    return NextResponse.json({
      ok: true,
      step,
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    if (!(error instanceof BillSourceAggregateError)) throw error;
    return NextResponse.json(
      {
        ok: false,
        step,
        started,
        finished: new Date().toISOString(),
        outcome: error.outcome,
        sourceFailures: error.outcomes.flatMap((source) =>
          source.status === "failed"
            ? [{ sourceId: source.sourceId, code: source.code }]
            : [],
        ),
      },
      { status: error.status },
    );
  }
}
