import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { requireCronAuth } from "@/lib/api/cron-auth";
import * as schema from "@/lib/db/schema";
import { classifyClusters } from "@/lib/pulse/v2/classify";
import {
  providerKeyEnvName,
  providerKeyPresent,
  resolveProviderConfig,
} from "@/lib/pulse/v2/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Two LLM calls per cluster (classify + verify) — allow generous time.
export const maxDuration = 800;

// ENABLE SEQUENCE (owner/main session, via the Vercel API):
//   1. Set DEEPSEEK_API_KEY (or GLM_API_KEY) in the Vercel project env.
//   2. Optionally set PULSE_CLASSIFY_PROVIDER / PULSE_CLASSIFY_MODEL and
//      PULSE_VERIFY_PROVIDER / PULSE_VERIFY_MODEL to override the DeepSeek
//      defaults. See .env.example and plan/pulse-classifier-cost-resolution-v1.md.
//   3. Redeploy so the new env reaches this route.
// Until the configured provider's key is present this route no-ops with a
// logged notice and HTTP 200 — so the cron can be deployed safely BEFORE
// keys arrive (no failed-cron noise, no accidental spend). CRON_SECRET auth
// is unchanged and still required.
async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();

  // Guard: both passes need their provider key present. If either is
  // missing, skip cleanly rather than throwing (a thrown classify call
  // would 500 the cron and could partially spend on the pass that IS keyed).
  const classifyCfg = resolveProviderConfig("classify");
  const verifyCfg = resolveProviderConfig("verify");
  const missing = [classifyCfg.provider, verifyCfg.provider]
    .filter((p, i, a) => a.indexOf(p) === i)
    .filter((p) => !providerKeyPresent(p));
  if (missing.length > 0) {
    const notice =
      `[cron pulse.v2.classify] skipped: no API key for provider(s) ` +
      `${missing.join(", ")} (set ${missing
        .map(providerKeyEnvName)
        .join(", ")} in the Vercel project env to enable).`;
    console.warn(notice);
    return NextResponse.json({
      ok: true,
      step: "pulse.v2.classify",
      skipped: true,
      reason: "provider_key_absent",
      missingProviders: missing,
      classifyProvider: `${classifyCfg.provider}/${classifyCfg.model}`,
      verifyProvider: `${verifyCfg.provider}/${verifyCfg.model}`,
      started,
      finished: new Date().toISOString(),
    });
  }

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
