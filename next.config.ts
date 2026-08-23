import type { NextConfig } from "next";

// Config-safe relative import — next.config.ts is loaded outside the
// app's `@/*` alias resolution context, so this must stay relative.
import { REDIRECTS } from "./src/lib/routing/redirects";

// Vercel's Protected Source Maps setting must be enabled before this build
// flag is set in production. The matching deployment variable is deliberately
// opt-in so no production build can accidentally publish browser source maps.
const protectedSourceMapsEnabled =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_PROTECTED_SOURCEMAPS === "true";

// Standard HTTP security response headers (deep audit 2026-06-07, Security #6).
// Kept deliberately conservative: NO content/script CSP (which could break the
// app) — the only CSP directive used is `frame-ancestors`, the modern companion
// to X-Frame-Options for clickjacking protection. HSTS is already applied at
// the platform layer, so it is not duplicated here.
//
// `BASE_SECURITY_HEADERS` are safe on every route, including the embeddable
// widget. The frame-busting pair (X-Frame-Options + frame-ancestors 'self') is
// applied separately to all routes EXCEPT /embed/* so the embed widget stays
// embeddable in third-party iframes.
// Minimal resource allowlist. Externally LOADED origins (not link targets) are
// map resources — OpenFreeMap (2D fallback style/tiles), the self-hosted
// Protomaps PMTiles archive on Vercel Blob, and Mapbox (opt-in 3D) — plus
// PostHog, the consent-gated analytics bundle. Fonts are self-hosted by
// next/font; there are no image CDNs.
//
// The PostHog origins are allowlisted here so the report-only policy stays
// quiet and a future enforcing flip does not break analytics. Allowlisting is
// not activation: the bundle is requested only after a reader grants consent
// (src/lib/analytics/consent.ts), so an undecided or declining reader still
// contacts none of these hosts.
// Shipped as Content-Security-Policy-Report-Only: enforcing script/style-src
// under Next's App Router requires per-request nonces (streaming injects inline
// scripts), so we observe violations first and flip to enforcing once a nonce
// pass lands. See plan/evidence/PLT-013/. (PLT-013)
const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://api.mapbox.com https://flagcdn.com https://commons.wikimedia.org https://upload.wikimedia.org",
  "font-src 'self'",
  "connect-src 'self' https://tiles.openfreemap.org https://*.blob.vercel-storage.com https://api.mapbox.com https://events.mapbox.com https://us.i.posthog.com https://us-assets.i.posthog.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const BASE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Enforced on HTTPS: one year, subdomains, preload-eligible.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: CONTENT_SECURITY_POLICY_REPORT_ONLY,
  },
];

const FRAME_PROTECTION_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  /* cacheComponents: true — re-enable after adding `use cache` to data functions */
  // CountryHoverCard uses the approved 70-quality preview rendition. Next 16
  // validates image optimizer quality requests against this explicit allowlist.
  images: {
    qualities: [70],
  },
  turbopack: {
    root: __dirname,
    // Stable bundle/map debug IDs bind a monitored release to its protected
    // source maps without retaining a stack trace in Civica's own database.
    debugIds: true,
  },
  productionBrowserSourceMaps: protectedSourceMapsEnabled,
  experimental: {
    // Server maps stay inside the function bundle; browser maps require the
    // explicit protected-source-map deployment flag above.
    serverSourceMaps: true,
  },
  async headers() {
    return [
      // Applies to every route (incl. /embed) — none of these affect framing.
      {
        source: "/:path*",
        headers: BASE_SECURITY_HEADERS,
      },
      // Clickjacking protection for everything EXCEPT the embed widget.
      // The negative lookahead `(?!embed/)` keeps /embed/[slug] framable
      // cross-origin while every other path is locked to same-origin framing.
      {
        source: "/((?!embed/).*)",
        headers: FRAME_PROTECTION_HEADERS,
      },
    ];
  },
  async redirects() {
    return REDIRECTS;
  },
};

export default nextConfig;
