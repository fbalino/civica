import { NextResponse } from "next/server";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import { getDb } from "@/lib/db";
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

  // HARD $0 LOCK (owner authority 2026-08-17,
  // plan/pulse-subscription-runtime-resolution-v1.md): classification runs
  // ONLY on the owner-Mac subscription-cli transport. This scheduled route
  // refuses to classify on any paid HTTP transport even when provider API
  // keys exist in the environment — key deletion is a second, independent
  // lock, not the only one. PULSE_CLASSIFY_TRANSPORT is never set on Vercel,
  // so this branch always takes effect there; the owner's local runner sets
  // it and runs the classify stage directly, not through this route.
  if ((process.env.PULSE_CLASSIFY_TRANSPORT ?? "").trim() !== "subscription-cli") {
    console.warn(
      "[cron pulse.v2.classify] locked: paid classifier transport is " +
        "disabled under the owner's $0 authority; classification runs on " +
        "the owner's subscription runtime instead.",
    );
    return NextResponse.json(
      {
        ok: false,
        outcome: "skipped",
        reason: "paid_transport_locked",
        step: "pulse.v2.classify",
        dryRun,
        skipped: true,
        started,
        finished: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

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
    const outcome = pulseV2ClassifyCronOutcome({
      missingProviders: missing,
    });
    return NextResponse.json(
      {
        ok: outcome.ok,
        outcome: outcome.outcome,
        reason: outcome.reason,
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
      { status: outcome.httpStatus },
    );
  }

  const db = getDb();
  const summary = await classifyClusters(db, {
    limit: 200,
    dryRun,
    cronExecutionKey,
  });
  const outcome = pulseV2ClassifyCronOutcome({ summary });
  return NextResponse.json(
    {
      ok: outcome.ok,
      outcome: outcome.outcome,
      reason: outcome.reason,
      step: "pulse.v2.classify",
      dryRun,
      started,
      finished: new Date().toISOString(),
      summary,
    },
    { status: outcome.httpStatus },
  );
}

const cronHandler = withCronJob("pulse.v2.classify", handler);

export { cronHandler as GET, cronHandler as POST };
