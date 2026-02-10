import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker builds (set STANDALONE=1 in Dockerfile).
  // Disabled on Windows dev where symlink creation fails (EPERM).
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
  transpilePackages: ["@capable-ai/shared"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
