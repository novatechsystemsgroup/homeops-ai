# HomeOps AI API and MCP host.
# The service runs TypeScript directly through tsx, so the image ships the workspace.
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV DB_PATH=/data/homeops.db
ENV PORT=8787

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate
# better-sqlite3 falls back to node-gyp when no prebuilt binary matches the platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
# --prod=false on purpose: NODE_ENV=production would skip devDependencies, and the
# service runs TypeScript through tsx, which is a dev dependency.
RUN pnpm install --frozen-lockfile --prod=false

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@homeops/api", "start"]

