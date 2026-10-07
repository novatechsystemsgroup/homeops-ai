import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const envPath = resolve(repoRoot, ".env");

if (existsSync(envPath)) loadDotenv({ path: envPath, quiet: true });

/** Fails fast with a helpful message instead of a stack trace full of 401s. */
export function requireKey(name: "NEBIUS_API_KEY" | "TAVILY_API_KEY"): string {
  const value = (process.env[name] ?? "").trim();
  if (value === "") {
    console.error(`\n[missing key] ${name} is empty.\nOpen ${envPath} and paste the key on that line, then run this probe again.\n`);
    process.exit(1);
  }
  return value;
}

/** Keys are never printed; this is only useful to confirm something was loaded. */
export function fingerprint(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-2)} (len ${value.length})`;
}

export function heading(title: string): void {
  console.log(`\n=== ${title} ===`);
}
