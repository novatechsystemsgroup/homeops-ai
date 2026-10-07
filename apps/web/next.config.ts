import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The deployment image is built from the traced standalone output (apps/web/Dockerfile).
  output: "standalone",
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

  /**
   * The same-origin proxy is implemented as route handlers (app/api, app/mcp,
   * app/healthz) rather than as rewrites: rewrite destinations are evaluated during
   * "next build" and would bake the build-time API URL into the image.
   */
};

export default nextConfig;
