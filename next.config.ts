import type { NextConfig } from "next";

// Config-safe relative import — next.config.ts is loaded outside the
// app's `@/*` alias resolution context, so this must stay relative.
import { REDIRECTS } from "./src/lib/routing/redirects";

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
const BASE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const FRAME_PROTECTION_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  /* cacheComponents: true — re-enable after adding `use cache` to data functions */
  turbopack: {
    root: __dirname,
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
