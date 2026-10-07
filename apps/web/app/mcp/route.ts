import { proxyToApi } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

/**
 * The MCP endpoint is proxied so the browser-facing origin stays the only public
 * hostname; the API keeps its bearer-token check and stays off the internet.
 */
export async function GET(request: Request): Promise<Response> {
  return proxyToApi(request, "/mcp");
}

export async function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/mcp");
}

export async function DELETE(request: Request): Promise<Response> {
  return proxyToApi(request, "/mcp");
}
