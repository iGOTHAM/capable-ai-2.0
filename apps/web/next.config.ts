import type { NextConfig } from "next";

// Force rebuild 1

const nextConfig: NextConfig = {
  transpilePackages: ["@capable-ai/shared"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
