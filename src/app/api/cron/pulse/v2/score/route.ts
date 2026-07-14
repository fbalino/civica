import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import * as schema from "@/lib/db/schema";
import { corroborateEvents } from "@/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "@/lib/pulse/v2/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const started = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const cronExecutionKey = cronExecutionKeyFromRequest(request);
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });
  const corroboration = await corroborateEvents(db, {
    dryRun,
    cronExecutionKey,
  });
  const scoring = await calculateDimensionalDeltas(db, {
    dryRun,
    cronExecutionKey,
  });
  return NextResponse.json({
    ok: true,
    step: "pulse.v2.score",
    dryRun,
    started,
    finished: new Date().toISOString(),
    summary: { corroboration, scoring },
  });
}

const cronHandler = withCronJob("pulse.v2.score", handler);

export { cronHandler as GET, cronHandler as POST };
