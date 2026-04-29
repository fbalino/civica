import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* cacheComponents: true — re-enable after adding `use cache` to data functions */
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
      // Phase C — tab consolidation 8 → 6.
      // Chamber folded into Structure (the house toggle now lives there).
      {
        source: "/atlas/:slug/chamber",
        destination: "/atlas/:slug/structure",
        permanent: true,
      },
      // Democracy folded into Scores & Rankings.
      {
        source: "/atlas/:slug/democracy",
        destination: "/atlas/:slug/scores",
        permanent: true,
      },
      // Elections at the country level retired; the global /elections
      // page is the canonical home for the elections directory.
      {
        source: "/atlas/:slug/elections",
        destination: "/elections",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
