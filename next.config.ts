import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* cacheComponents: true — re-enable after adding `use cache` to data functions */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/index",
          destination: "/civica-index",
        },
        {
          source: "/index/:path*",
          destination: "/civica-index/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
