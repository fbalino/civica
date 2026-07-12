import type { NextRequest } from "next/server";
import { INDEX_COMPOSITE_SUNSET_DATE } from "@/lib/api/deprecation";
import { RIGHTS_REGISTRY_URL } from "@/lib/claims/reuse-rights";

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Security-Policy": "frame-ancestors *",
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    Deprecation: "true",
    Sunset: INDEX_COMPOSITE_SUNSET_DATE,
    Link: '</governance-evidence>; rel="successor-version"',
  };
}

export async function OPTIONS() {
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
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const countryHref = `/governance-evidence?country=${encodeURIComponent(slug)}`;
  // PUBLIC_CLAIM: embeds.retired-index
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="civica:rights" content="${RIGHTS_REGISTRY_URL}"><title>Civica Index embed retired</title></head>
<body><main><p><strong>This Civica Index embed has been retired.</strong></p><p>Civica now publishes source-native governance evidence without a composite country score or rank.</p><p><a href="${countryHref}" target="_top">Open Governance Evidence</a></p><p><a href="/licensing#reuse" target="_top">Rights and reuse</a></p></main></body></html>`;
  return new Response(html, { status: 410, headers: headers() });
}
