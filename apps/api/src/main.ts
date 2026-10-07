import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { loadRepoEnv, loadServerConfig, findRepoRoot } from "./config";
import { createContainer } from "./container";
import { createLogger } from "./http/logger";
import { createMcpHandler } from "./mcp/mount";
import { createApp } from "./server";

const repoRoot = findRepoRoot();
loadRepoEnv(repoRoot);

const config = loadServerConfig(process.env, repoRoot);
const logger = createLogger(config.LOG_LEVEL);
const container = createContainer(config, logger);
const app = createApp(container);
const mcpHandler = createMcpHandler(container);

const honoListener = getRequestListener(app.fetch);

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/mcp" || url.startsWith("/mcp?")) {
    void mcpHandler(req, res);
    return;
  }
  void honoListener(req, res);
});

server.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      mcp: `http://localhost:${config.PORT}/mcp`,
      modelProvider: container.model.name,
      searchProvider: container.search.name,
      database: config.databasePath
    },
    "homeops-ai api ready"
  );
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    container.close();
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
