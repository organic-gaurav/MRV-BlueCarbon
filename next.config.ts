import type { NextConfig } from "next";

/**
 * Two build modes:
 *  - default          : server build, used by `npm run dev` / `npm run start`
 *  - NEXT_OUTPUT=export: static export to ./out for GitHub Pages
 */
const isExport = process.env.NEXT_OUTPUT === "export";
const repo = "MRV-BlueCarbon";

const nextConfig: NextConfig = {
  // Allow the sandbox preview host (*.e2b.app) to reach the dev server.
  allowedDevOrigins: ["*.e2b.app", "localhost"],
  devIndicators: false,
  ...(isExport
    ? {
        output: "export" as const,
        // GitHub Pages serves project sites from /<repo>/, not the domain root.
        basePath: process.env.GH_PAGES === "true" ? `/${repo}` : undefined,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
