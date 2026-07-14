import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import * as schema from "@/lib/db/schema";
import { classifyClusters } from "@/lib/pulse/v2/classify";
import {
  providerKeyEnvName,
  providerKeyPresent,
  resolveClassifyEnsemble,
  resolveEnsembleVerifyConfig,
  resolveProviderConfig,
} from "@/lib/pulse/v2/provider";
import {
  SUBJECT_ATTRIBUTION_MODEL,
  SUBJECT_ATTRIBUTION_PROVIDER,
} from "@/lib/pulse/v2/country-attribution";
import { pulseV2ClassifyCronOutcome } from "@/lib/pulse/v2/cron-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Multiple parallel classify voters, one adversarial verify call, and one
// subject-country attribution call per accepted cluster.
export const maxDuration = 800;

// ENABLE SEQUENCE (owner/main session, via the Vercel API):
//   1. Set the API keys required by every configured ensemble voter, the
//      verifier, and the subject-country attribution pass.
//   2. Optionally set PULSE_CLASSIFY_ENSEMBLE and PULSE_ENSEMBLE_VERIFY.
//   3. Redeploy so the new env reaches this route.
// Until every configured provider key is present this route makes no model
// calls and returns HTTP 503, so deployment can precede credential setup
// without claiming that classification completed.
async function handler(request: Request) {
  const started = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const cronExecutionKey = cronExecutionKeyFromRequest(request);

  // Guard the configuration that classify.ts actually runs. Subject-country
  // attribution is a separate Anthropic pass and must be keyed even when the
  // voter/verifier configuration does not otherwise include Anthropic.
  const classifyEnsemble = resolveClassifyEnsemble();
  const ensembleMode = classifyEnsemble.length > 1;
  const classifyConfigs = ensembleMode
    ? classifyEnsemble
    : [classifyEnsemble[0]];
  const verifyCfg = ensembleMode
    ? resolveEnsembleVerifyConfig()
    : resolveProviderConfig("verify");
  const requiredProviders = [
    ...classifyConfigs.map((cfg) => cfg.provider),
    verifyCfg.provider,
    SUBJECT_ATTRIBUTION_PROVIDER,
  ];
  const missing = requiredProviders
    .filter((p, i, a) => a.indexOf(p) === i)
    .filter((p) => !providerKeyPresent(p));
  if (missing.length > 0) {
    const notice =
      `[cron pulse.v2.classify] blocked: no API key for provider(s) ` +
      `${missing.join(", ")} (set ${missing
        .map(providerKeyEnvName)
        .join(", ")} in the Vercel project env to enable).`;
    console.warn(notice);
    const { httpStatus, ...outcome } = pulseV2ClassifyCronOutcome({
      missingProviders: missing,
    });
    return NextResponse.json(
      {
        ...outcome,
        step: "pulse.v2.classify",
        dryRun,
        skipped: true,
        missingProviders: missing,
        classifyProviders: classifyConfigs.map(
          (cfg) => `${cfg.provider}/${cfg.model}`,
        ),
        verifyProvider: `${verifyCfg.provider}/${verifyCfg.model}`,
        subjectAttributionProvider: `${SUBJECT_ATTRIBUTION_PROVIDER}/${SUBJECT_ATTRIBUTION_MODEL}`,
        started,
        finished: new Date().toISOString(),
      },
      { status: httpStatus },
    );
  }

  try {
    const sqlClient = neon(process.env.DATABASE_URL!);
    const db = drizzle({ client: sqlClient, schema });
    const summary = await classifyClusters(db, {
      limit: 200,
      dryRun,
      cronExecutionKey,
    });
    const { httpStatus, ...outcome } = pulseV2ClassifyCronOutcome({ summary });
    return NextResponse.json(
      {
        ...outcome,
        step: "pulse.v2.classify",
        dryRun,
        started,
        finished: new Date().toISOString(),
        summary,
      },
      { status: httpStatus },
    );
  } catch (err) {
    console.error("[cron pulse.v2.classify] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.classify",
        dryRun,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("pulse.v2.classify", handler);

export { cronHandler as GET, cronHandler as POST };
