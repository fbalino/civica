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
    ];
  },
};

export default nextConfig;
