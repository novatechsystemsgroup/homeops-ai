# HomeOps AI web app (Alexa+ simulator and agent trace console).
FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

WORKDIR /app

# Manifests first: the install layer survives source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/adapters-nebius/package.json packages/adapters-nebius/
COPY packages/adapters-tavily/package.json packages/adapters-tavily/
COPY packages/agent-core/package.json packages/agent-core/
COPY packages/contracts/package.json packages/contracts/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/persistence/package.json packages/persistence/
COPY packages/test-fixtures/package.json packages/test-fixtures/

# pnpm installs the whole workspace even when filtered, so the native dependency of
# the API package (better-sqlite3) needs a toolchain here as well.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# Empty by default: the browser calls its own origin and the Next proxy forwards to the API.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm --filter @homeops/web build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]

