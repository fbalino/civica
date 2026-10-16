import { NextResponse } from "next/server";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { zFactSourcePanel } from "@/lib/api/contract/fact-source-panel";
import { getCanonicalFact } from "@/lib/factbook/reconcile/api";
import { buildFactSourcePanel } from "@/lib/factbook/reconcile/fact-panel-model";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

/**
 * Reconciliation detail for one jurisdiction and fact key, shown when a
 * reader opens a value's source panel. Country pages carry only a compact
 * source reference; this request-live endpoint supplies the resolver trace,
 * alternates and rejected rows on demand.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jurisdictionId: string; factKey: string }> },
) {
  return withSafeJsonErrors(
    "api/facts/[jurisdictionId]/[factKey]/panel",
    async () => {
      const limited = await enforceRequestRateLimit(
        request,
        getRequestRateLimitPolicy("public-dynamic-read"),
      );
      if (limited) return limited;
      const path = await parsePathContract(params, "fact-source-panel-params/v1");
      if (!path.ok) return path.response;

      const { jurisdictionId, factKey } = path.data;
      const output = await getCanonicalFact(jurisdictionId, factKey);
      if (output.all.length === 0) {
        return apiProblem("NOT_FOUND", {
          headers: { "X-Robots-Tag": "noindex" },
        });
      }

      const panel = zFactSourcePanel.parse(
        buildFactSourcePanel(factKey, output),
      );
      return NextResponse.json(panel, {
        headers: {
          "Cache-Control": cacheControlFor("public-live"),
          "X-Robots-Tag": "noindex",
        },
      });
    },
  );
}
