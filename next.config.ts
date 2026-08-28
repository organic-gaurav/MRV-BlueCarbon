import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the sandbox preview host (*.e2b.app) to reach the dev server.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost"],
  devIndicators: false,
};

export default nextConfig;
