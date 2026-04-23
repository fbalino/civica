import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* cacheComponents: true — re-enable after adding `use cache` to data functions */
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
