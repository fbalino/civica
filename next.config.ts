import type { NextConfig } from "next";

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
    return [
      {
        source: "/preview",
        destination: "/",
        permanent: true,
      },
      {
        source: "/index",
        destination: "/civica-index",
        permanent: true,
      },
      {
        source: "/index/:path*",
        destination: "/civica-index/:path*",
        permanent: true,
      },
      {
        source: "/civica-index/compare",
        destination: "/compare",
        permanent: true,
      },
      {
        source: "/civica-index/compare/:path*",
        destination: "/compare/:path*",
        permanent: true,
      },
      // Legacy SEO-friendly pretty URLs: /compare/united-states-vs-france →
      // /compare?c=united-states&c=france. Preserves canonical authority
      // transfer to the new query-param-driven page.
      {
        source: "/compare/:a-vs-:b",
        destination: "/compare?c=:a&c=:b",
        permanent: true,
      },
      // Phase 5.4 — /outcomes renamed to /civica-conditions.
      // 308 (permanent redirect) transfers SEO authority to the new URL.
      {
        source: "/outcomes",
        destination: "/civica-conditions",
        permanent: true,
      },
      // Option B (Phase 2) — the duplicate atlas country + compare +
      // organizations experiences are retired. The factbook is the
      // canonical per-country reader, /compare is the canonical compare,
      // and the org explorer moved to a standalone /organizations page.
      // These redirects must precede the (now-removed) per-tab routes so
      // external links keep resolving. Order matters: the more-specific
      // /atlas/compare + /atlas/organizations rules come before the
      // catch-all /atlas/:slug/:tab.
      {
        source: "/atlas/compare",
        destination: "/compare",
        permanent: true,
      },
      {
        source: "/atlas/organizations",
        destination: "/organizations",
        permanent: true,
      },
      {
        source: "/atlas/organizations/:slug",
        destination: "/organizations/:slug",
        permanent: true,
      },
      // Country tabs → the factbook country reader (covers hemicycle,
      // bills, leaders, scores, structure, sections). The global
      // /elections page remains the canonical home for elections, so
      // keep that earlier, more-specific rule winning below.
      {
        source: "/atlas/:slug/elections",
        destination: "/elections",
        permanent: true,
      },
      {
        source: "/atlas/:slug/:tab",
        destination: "/factbook/:slug",
        permanent: true,
      },
      {
        source: "/atlas/:slug",
        destination: "/factbook/:slug",
        permanent: true,
      },
      // Phase 5.10 polish — the legacy v1 changelog page reads from
      // pulse_changelog / pulse_daily_scores tables that are no longer
      // surfaced post-cut-over. Public users get the v2 changelog at
      // /civica-index/pulse-changelog. Preserve any external links.
      {
        source: "/civica-index/changelog",
        destination: "/civica-index/pulse-changelog",
        permanent: true,
      },
      // Phase D.2 — /factbook is the new canonical country reader.
      // The legacy /countries/[slug] parent page stays live (per the
      // factbook plan §2.2), but the per-tab sub-routes redirect into
      // the matching factbook section anchor. /countries/[slug]/outcomes
      // is intentionally NOT redirected — Outcomes is postponed pending
      // a methodology project, so the legacy page is the only home for
      // peer-band data right now.
      {
        source: "/countries/:slug/leaders",
        destination: "/factbook/:slug#leaders",
        permanent: true,
      },
      {
        source: "/countries/:slug/democracy",
        destination: "/factbook/:slug#scores",
        permanent: true,
      },
      {
        source: "/countries/:slug/constitution",
        destination: "/factbook/:slug",
        permanent: true,
      },
      // Phase 3d (structural_family removal) — top-level
      // /government-types and /government-types/[type] pages are
      // archived per the 2026-05-02 peer-grouping resolution. The
      // educational appeal of "what's a parliamentary democracy"
      // now lives in the methodology page, where the constitutional
      // form is descriptive metadata rather than an analytical
      // taxonomy. Implementation plan §B-3d locks this redirect.
      {
        source: "/government-types",
        destination: "/civica-index/methodology/peer-grouping",
        permanent: true,
      },
      {
        source: "/government-types/:type",
        destination: "/civica-index/methodology/peer-grouping",
        permanent: true,
      },
      // /factbook/methodology was the parent page referenced from older
      // links/sitemaps but never existed as a real route. The reconciliation
      // page is the canonical methodology home for the factbook.
      {
        source: "/factbook/methodology",
        destination: "/factbook/methodology/reconciliation",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
