import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "@homeops/mcp-server";
import type { Container } from "../container";

const MAX_BODY_BYTES = 1_000_000;

/** MCP is mounted on its own raw Node handler so the Streamable HTTP transport owns the response. */
export function createMcpHandler(container: Container) {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const authToken = container.config.MCP_AUTH_TOKEN.trim();

  const unauthorized = (res: ServerResponse): void => {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        type: "https://homeops.ai/problems/unauthorized",
        title: "Unauthorized",
        status: 401,
        code: "unauthorized",
        detail: "A valid bearer token is required for the MCP endpoint."
      })
    );
  };

  const badRequest = (res: ServerResponse, message: string): void => {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
  };

  const readBody = async (req: IncomingMessage): Promise<unknown> => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = chunk as Buffer;
      size += buffer.length;
      if (size > MAX_BODY_BYTES) throw new Error("Request body too large.");
      chunks.push(buffer);
    }
    if (chunks.length === 0) return undefined;
    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (text === "") return undefined;
    return JSON.parse(text);
  };

  return async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (authToken !== "" && (req.headers.authorization ?? "") !== `Bearer ${authToken}`) {
        unauthorized(res);
        return;
      }

      const sessionHeader = req.headers["mcp-session-id"];
      const sessionId = typeof sessionHeader === "string" ? sessionHeader : undefined;
      const existing = sessionId ? transports.get(sessionId) : undefined;

      if (existing) {
        await existing.handleRequest(req, res);
        return;
      }

      if (req.method !== "POST") {
        badRequest(res, "Bad Request: no valid MCP session for this request.");
        return;
      }

      const body = await readBody(req);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
          container.logger.info({ sessionId: id }, "mcp session opened");
        },
        onsessionclosed: (id) => {
          transports.delete(id);
          container.logger.info({ sessionId: id }, "mcp session closed");
        }
      });
      transport.onerror = (error) => container.logger.warn({ err: error.message }, "mcp transport error");

      const server = buildMcpServer(container.service, { version: "0.1.0" });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      container.logger.error({ err: error instanceof Error ? error.message : String(error) }, "mcp request failed");
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
      }
    }
  };
}
