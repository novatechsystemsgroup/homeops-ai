import type { NextConfig } from "next";

/** In production the API stays on the internal network and the web app proxies to it. */
const internalApiUrl = (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");

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
  allowedDevOrigins: ["localhost", "127.0.0.1"],

  /**
   * Same-origin deployment: the browser only talks to this host, so there is no CORS
   * configuration to get wrong and the API never needs a public hostname.
   */
  async rewrites() {
    return [
      { source: "/healthz", destination: internalApiUrl + "/healthz" },
      { source: "/api/:path*", destination: internalApiUrl + "/api/:path*" },
      { source: "/mcp", destination: internalApiUrl + "/mcp" }
    ];
  }
};

export default nextConfig;
