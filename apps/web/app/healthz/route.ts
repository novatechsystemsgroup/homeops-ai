import { proxyToApi } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return proxyToApi(request, "/healthz");
}
