import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { requireCronAuth } from "@/lib/api/cron-auth";
import * as schema from "@/lib/db/schema";
import { runClustering } from "@/lib/pulse/v2/cluster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// First invocation downloads and loads the multilingual MiniLM model.
// Subsequent calls reuse the cached pipeline; allow extra time for cold start.
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle({ client: sqlClient, schema });
    const summary = await runClustering(db, { limit: 1000 });
    return NextResponse.json({
      ok: true,
      step: "pulse.v2.cluster",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron pulse.v2.cluster] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.cluster",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
