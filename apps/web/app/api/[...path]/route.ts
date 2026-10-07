import { proxyToApi } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  return proxyToApi(request, `/api/${path.join("/")}`);
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
export const OPTIONS = forward;
