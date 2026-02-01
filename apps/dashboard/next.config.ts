import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" is enabled for production Docker builds.
  // On Windows dev, symlinks fail, so we leave it off locally.
  // Uncomment for production: output: "standalone",
  transpilePackages: ["@capable-ai/shared"],
};

export default nextConfig;
