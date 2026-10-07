import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them for the browser.
  transpilePackages: ["@homeops/contracts"],
  reactStrictMode: true
};

export default nextConfig;
