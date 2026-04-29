import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { requireCronAuth } from "@/lib/api/cron-auth";
import * as schema from "@/lib/db/schema";
import { corroborateEvents } from "@/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "@/lib/pulse/v2/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle({ client: sqlClient, schema });
    const corroboration = await corroborateEvents(db);
    const scoring = await calculateDimensionalDeltas(db);
    return NextResponse.json({
      ok: true,
      step: "pulse.v2.score",
      started,
      finished: new Date().toISOString(),
      summary: { corroboration, scoring },
    });
  } catch (err) {
    console.error("[cron pulse.v2.score] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.score",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
