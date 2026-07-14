import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import * as schema from "@/lib/db/schema";
import { runClustering } from "@/lib/pulse/v2/cluster";
import { pulseV2ClusterCronOutcome } from "@/lib/pulse/v2/cron-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// First invocation downloads and loads the multilingual MiniLM model.
// Subsequent calls reuse the cached pipeline; allow extra time for cold start.
export const maxDuration = 300;

async function handler(request: Request) {
  const started = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const cronExecutionKey = cronExecutionKeyFromRequest(request);
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle({ client: sqlClient, schema });
    const summary = await runClustering(db, {
      limit: 1000,
      dryRun,
      cronExecutionKey,
    });
    const { httpStatus, ...outcome } = pulseV2ClusterCronOutcome(summary);
    return NextResponse.json(
      {
        ...outcome,
        step: "pulse.v2.cluster",
        dryRun,
        started,
        finished: new Date().toISOString(),
        summary,
      },
      { status: httpStatus },
    );
  } catch (err) {
    console.error("[cron pulse.v2.cluster] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.cluster",
        dryRun,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("pulse.v2.cluster", handler);

export { cronHandler as GET, cronHandler as POST };
