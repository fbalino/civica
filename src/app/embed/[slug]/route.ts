import type { NextRequest } from "next/server";
import { INDEX_COMPOSITE_SUNSET_DATE } from "@/lib/api/deprecation";
import { RIGHTS_REGISTRY_URL } from "@/lib/claims/reuse-rights";
import { parsePathContract } from "@/lib/api/request-contract";
import { withResponseCacheProfile } from "@/lib/api/response-cache";

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Security-Policy": "frame-ancestors *",
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    Deprecation: "true",
    Sunset: INDEX_COMPOSITE_SUNSET_DATE,
    Link: '</governance-evidence>; rel="successor-version"',
  };
}

async function handleOptions() {
  return new Response(null, { status: 204, headers: headers() });
}

/**
 * The old iframe rendered a Civica composite score. That output conflicts
 * with the selected source-native public disposition, so every legacy embed
 * fails closed with an explanatory replacement link. It never returns a
 * stale score, rank, or dimension value.
 *
 * PROVENANCE_COVERAGE: embeds.retired-index
 */
async function handleEmbed(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const path = await parsePathContract(params, "embed-slug-params/v1");
  if (!path.ok) return path.response;
  const { slug } = path.data;
  const countryHref = `/governance-evidence?country=${encodeURIComponent(slug)}`;
  // PUBLIC_CLAIM: embeds.retired-index
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="description" content="Retirement notice for the former Civica Index embed."><meta name="civica:rights" content="${RIGHTS_REGISTRY_URL}"><title>Civica Index embed retired</title></head>
<body><main aria-labelledby="embed-retired-title"><h1 id="embed-retired-title">Civica Index embed retired</h1><p>This Civica Index embed has been retired. Civica now publishes source-native governance evidence without a composite country score or rank.</p><p><a href="${countryHref}" target="_top">Open Governance Evidence</a> · <a href="/licensing#reuse" target="_top">Rights and reuse</a></p></main></body></html>`;
  return new Response(html, { status: 410, headers: headers() });
}

export async function OPTIONS() {
  return withResponseCacheProfile("public-live", handleOptions);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  return withResponseCacheProfile("public-live", () =>
    handleEmbed(request, context),
  );
}
