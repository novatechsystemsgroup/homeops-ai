# Deployment (Coolify)

HomeOps AI runs as two containers on the existing Coolify server:

```text
Internet -> Coolify/Traefik (TLS)
              |
              +-- homeops.novatechsystem.co.uk        -> web container (Next.js, port 3000)
                                                          |  /api/*  /mcp  /healthz  (server-side route handlers)
                                                          v
                                                       api container (Fastify-less Hono host, port 8787, internal only)
                                                          |
                                                          +-- volume /data -> SQLite
```

Only the web container is published. The API has no public hostname, so there is no CORS
surface, no second certificate and no way to reach the MCP endpoint without going through
the web proxy and its bearer token.

## What is needed before deploying

| Item | Where it comes from |
|---|---|
| Coolify server with spare capacity (1 vCPU / 1 GB is enough for the demo) | already running for NovaOps / NovaQuant |
| DNS record `homeops.novatechsystem.co.uk` | Cloudflare zone `novatechsystem.co.uk` (currently the apex is proxied) |
| `NEBIUS_API_KEY` | Nebius Token Factory console |
| `TAVILY_API_KEY` | Tavily dashboard |
| `MCP_AUTH_TOKEN` | generate with `openssl rand -hex 24` |

## DNS

Add one record in the Cloudflare dashboard for `novatechsystem.co.uk`:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `homeops` | the Coolify server's public IP | DNS only (grey cloud) recommended |

Let Coolify issue the Let's Encrypt certificate first, then optionally switch the record to
proxied (orange cloud) with SSL/TLS mode **Full (strict)**. A proxied record with "Flexible"
SSL breaks the redirect loop and must be avoided.

## Coolify: two applications

Create both from this repository (branch `main`), build pack **Dockerfile**.

### 1. `homeops-api`

| Setting | Value |
|---|---|
| Dockerfile | `apps/api/Dockerfile` |
| Port | `8787` |
| Domain | none (internal only) |
| Volume | `homeops-data` mounted at `/data` (holds `homeops.db`) |
| Healthcheck | provided by the image: `GET /healthz` |

Environment:

```text
NODE_ENV=production
PORT=8787
DB_PATH=/data/homeops.db

MODEL_PROVIDER=nebius
SEARCH_PROVIDER=tavily
NEBIUS_API_KEY=<their key>
NEBIUS_BASE_URL=https://api.tokenfactory.us-central1.nebius.com/v1/
NEBIUS_MODEL_PLAN=nvidia/Nemotron-3_5-Lightning
NEBIUS_MODEL_FAST=nvidia/Nemotron-3_5-Lightning
TAVILY_API_KEY=<their key>

MCP_AUTH_TOKEN=<openssl rand -hex 24>
LOG_LEVEL=info
SEARCH_RESULT_LIMIT=5
SEARCH_ENABLED=true
MODEL_TIMEOUT_MS=60000
```

### 2. `homeops-web`

| Setting | Value |
|---|---|
| Dockerfile | `apps/web/Dockerfile` |
| Port | `3000` |
| Domain | `https://homeops.novatechsystem.co.uk` |
| Build arg | `NEXT_PUBLIC_API_BASE_URL=""` (same origin: the browser calls the proxy) |

Environment:

```text
NODE_ENV=production
PORT=3000
INTERNAL_API_URL=http://homeops-api:8787
```

Coolify puts both applications on the same Docker network. The API carries an explicit
network alias, `homeops-api` (`custom_network_aliases` on the application), because container
names include a per-deployment suffix and cannot be used as a stable hostname.

The proxy is implemented as **route handlers** (`app/api/[...path]`, `app/mcp`, `app/healthz`),
not as Next rewrites: rewrite destinations are resolved during `next build` and would bake the
build-time URL into the image — which is exactly how the first deployment ended up calling
`127.0.0.1:8787`. Route handlers read `INTERNAL_API_URL` at request time and stream the
upstream response, so MCP `text/event-stream` keeps working.

## Local parity

```bash
docker compose build
docker compose up -d          # web on http://localhost:3000, API internal
docker compose logs -f web
```

`docker compose` reads `.env`, so a local run uses the same providers as the workstation
(fake providers if the keys are empty, real Nebius + Tavily if they are set).

## Verification after deploy

```bash
BASE=https://homeops.novatechsystem.co.uk
curl -sS $BASE/healthz | jq .                      # proxied API health
curl -sS $BASE/api/meta | jq '{modelProvider, model, searchProvider}'
curl -sS -o /dev/null -w '%{http_code}\n' -X POST $BASE/mcp -H 'content-type: application/json' -d '{}'   # expect 401

# Full MCP tool discovery and a tool call against the public endpoint:
MCP_URL=$BASE npm --package=tsx --package=@modelcontextprotocol/sdk dlx tsx scripts/mcp-smoke.ts
BASE_URL=$BASE pnpm check:live                     # real browser: triage, plan, sources
```

## Operations

- **Update:** push to `main`, then redeploy both applications in Coolify (the web build takes ~2 minutes).
- **Data:** everything synthetic lives in the `/data` volume. Deleting the volume resets the demo;
  the household is re-seeded on first request (`GET /api/households/demo`).
- **Secrets:** only in Coolify environment variables. `.env` stays untracked; the secret scanner
  (`pnpm scan:secrets`) must stay green before every push.
- **Cost:** no additional hosting cost; the demo uses the existing Coolify server and the two API keys.
- **Kill switch:** stop both applications in Coolify; the DNS record can stay.

