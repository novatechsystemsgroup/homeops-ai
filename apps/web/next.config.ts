import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own dev server: a separate build directory keeps it from fighting
  // with a developer's "pnpm dev" over the same .next folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Workspace packages ship raw TypeScript; Next compiles them for the browser.
  transpilePackages: ["@homeops/contracts"],
  reactStrictMode: true,
  // The dev server is reached as 127.0.0.1 in tests and as localhost in the
  // browser. Without this, Next blocks its own dev resources (including HMR)
  // and the client app never hydrates.
  allowedDevOrigins: ["localhost", "127.0.0.1"]
};

export default nextConfig;
