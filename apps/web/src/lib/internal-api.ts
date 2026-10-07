/**
 * Server-side target for the API container. Read at request time, not at build time:
 * Next bakes rewrite destinations during "next build", which silently produced a
 * localhost URL in the container.
 */
export const INTERNAL_API_URL = (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "");

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding"
]);

function copyHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

/**
 * Streams a request to the API and returns its response unchanged, including
 * text/event-stream, which the MCP transport relies on.
 */
export async function proxyToApi(request: Request, path: string): Promise<Response> {
  const search = new URL(request.url).search;
  const target = `${INTERNAL_API_URL}${path}${search}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: copyHeaders(request.headers),
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual"
    });
    return new Response(upstream.body, { status: upstream.status, headers: copyHeaders(upstream.headers) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        type: "https://homeops.ai/problems/api_unreachable",
        title: "API unreachable",
        status: 502,
        code: "api_unreachable",
        detail: `The web app could not reach the API at ${INTERNAL_API_URL}: ${detail}`
      },
      { status: 502 }
    );
  }
}
