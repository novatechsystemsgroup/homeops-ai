import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { DEFAULT_FAST_MODEL, DEFAULT_NEBIUS_BASE_URL, DEFAULT_PLAN_MODEL } from "@homeops/adapters-nebius";

/** Walks up from this file until it finds the repository .env (apps/api/src -> repo root). */
export function findRepoRoot(startDir = dirname(fileURLToPath(import.meta.url))): string {
  let dir = startDir;
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    dir = resolve(dir, "..");
  }
  return startDir;
}

export function loadRepoEnv(repoRoot = findRepoRoot()): string | null {
  const candidate = resolve(repoRoot, ".env");
  if (!existsSync(candidate)) return null;
  loadDotenv({ path: candidate, quiet: true });
  return candidate;
}

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

export const ServerEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  // 0 means "any free port" and is used by the in-process MCP smoke test.
  PORT: z.coerce.number().int().min(0).max(65535).default(8787),
  LOG_LEVEL: z.string().default("info"),
  MCP_AUTH_TOKEN: z.string().default("dev-local-token"),
  MODEL_PROVIDER: z.enum(["nebius", "fake"]).default("fake"),
  SEARCH_PROVIDER: z.enum(["tavily", "fake"]).default("fake"),
  NEBIUS_API_KEY: z.string().default(""),
  NEBIUS_BASE_URL: z.string().default(DEFAULT_NEBIUS_BASE_URL),
  NEBIUS_MODEL_PLAN: z.string().default(DEFAULT_PLAN_MODEL),
  NEBIUS_MODEL_FAST: z.string().default(DEFAULT_FAST_MODEL),
  TAVILY_API_KEY: z.string().default(""),
  DB_PATH: z.string().default("./.data/homeops.db"),
  // Zod 4 applies .default() to the transformed (output) value.
  SEARCH_ENABLED: booleanish.default(true),
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
  SEARCH_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15_000),
  // Measured: asking for more than a handful makes Tavily pad the list with trade
  // directories, so the default stays deliberately small.
  SEARCH_RESULT_LIMIT: z.coerce.number().int().min(1).max(10).default(5),
  /** Comma-separated browser origins allowed to call the API (the web app is on another port). */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100")
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export interface ServerConfig extends Omit<ServerEnv, "CORS_ORIGINS"> {
  repoRoot: string;
  databasePath: string;
  corsOrigins: string[];
  /** True when a requested provider had no credentials and was replaced by the fake one. */
  degradedProviders: string[];
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env, repoRoot = findRepoRoot()): ServerConfig {
  const parsed = ServerEnvSchema.parse(env);
  const degradedProviders: string[] = [];

  let modelProvider = parsed.MODEL_PROVIDER;
  let searchProvider = parsed.SEARCH_PROVIDER;

  if (modelProvider === "nebius" && parsed.NEBIUS_API_KEY.trim() === "") {
    if (parsed.NODE_ENV === "production") throw new Error("MODEL_PROVIDER=nebius requires NEBIUS_API_KEY");
    modelProvider = "fake";
    degradedProviders.push("nebius (missing NEBIUS_API_KEY)");
  }
  if (searchProvider === "tavily" && parsed.TAVILY_API_KEY.trim() === "") {
    if (parsed.NODE_ENV === "production") throw new Error("SEARCH_PROVIDER=tavily requires TAVILY_API_KEY");
    searchProvider = "fake";
    degradedProviders.push("tavily (missing TAVILY_API_KEY)");
  }

  return {
    ...parsed,
    MODEL_PROVIDER: modelProvider,
    SEARCH_PROVIDER: searchProvider,
    repoRoot,
    corsOrigins: parsed.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ""),
    databasePath: parsed.DB_PATH === ":memory:" ? ":memory:" : resolve(repoRoot, parsed.DB_PATH),
    degradedProviders
  };
}
