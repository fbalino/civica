import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { requireCronAuth } from "@/lib/api/cron-auth";
import * as schema from "@/lib/db/schema";
import { classifyClusters } from "@/lib/pulse/v2/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Two LLM calls per cluster (classify + verify) — allow generous time.
export const maxDuration = 800;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle({ client: sqlClient, schema });
    const summary = await classifyClusters(db, { limit: 200 });
    return NextResponse.json({
      ok: true,
      step: "pulse.v2.classify",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron pulse.v2.classify] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.classify",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
