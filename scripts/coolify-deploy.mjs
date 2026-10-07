#!/usr/bin/env node
/**
 * Creates (or updates) the two HomeOps AI applications in Coolify and deploys them.
 *
 * Credentials are read from an env file outside the repository:
 *   ~/.config/homeops/coolify.env   (chmod 600)
 *   COOLIFY_URL=... COOLIFY_TOKEN=... NEBIUS_API_KEY=... TAVILY_API_KEY=...
 *
 *   node scripts/coolify-deploy.mjs            # dry run: prints the plan
 *   node scripts/coolify-deploy.mjs --apply    # creates/updates and deploys
 *
 * Secrets are never printed: only lengths and API status codes.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ENV_PATH = process.env.HOMEHOPS_DEPLOY_ENV || join(homedir(), ".config", "homeops", "coolify.env");
const APPLY = process.argv.includes("--apply");

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith(chr(34)) || value.startsWith(chr(39))) {
      const quote = value[0];
      if (value.endsWith(quote) && value.length > 1) value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function chr(code) { return String.fromCharCode(code); }

const cfg = parseEnv(readFileSync(ENV_PATH, "utf8"));
const BASE = (cfg.COOLIFY_URL || "").replace(/\/+$/, "");
const TOKEN = cfg.COOLIFY_TOKEN || "";

const PROJECT_UUID = cfg.COOLIFY_PROJECT_UUID || "cn22kbksximprcs7nxkb7ask";
const SERVER_UUID = cfg.COOLIFY_SERVER_UUID || "v6d1grdusar3nhu88ytdo356";
const DESTINATION_UUID = cfg.COOLIFY_DESTINATION_UUID || "l5v1cz8h2yrt266xn2of8v0s";
const GITHUB_REPO = cfg.GITHUB_REPO || "novatechsystemsgroup/homeops-ai";
const BRANCH = cfg.GITHUB_BRANCH || "main";
const WEB_DOMAIN = cfg.WEB_DOMAIN || "https://homeops.novatechsystem.co.uk";
const MCP_AUTH_TOKEN = cfg.MCP_AUTH_TOKEN || "change-me-before-public-demo";

if (!BASE || !TOKEN) {
  console.error("Missing COOLIFY_URL or COOLIFY_TOKEN in " + ENV_PATH);
  process.exit(1);
}

async function api(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!response.ok) {
    const detail = typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300);
    throw new Error(method + " " + path + " -> HTTP " + response.status + ": " + detail);
  }
  return parsed;
}

function appPayload(name, options) {
  return {
    project_uuid: PROJECT_UUID,
    server_uuid: SERVER_UUID,
    environment_name: cfg.COOLIFY_ENVIRONMENT || "production",
    destination_uuid: DESTINATION_UUID,
    git_repository: GITHUB_REPO,
    git_branch: BRANCH,
    build_pack: "dockerfile",
    dockerfile_location: options.dockerfile,
    base_directory: "/",
    ports_exposes: options.port,
    instant_deploy: false,
    name,
    ...(options.domain ? { domains: options.domain, fqdn: options.domain } : {})
  };
}

const API_ENV = [
  ["NODE_ENV", "production"],
  ["PORT", "8787"],
  ["DB_PATH", "/data/homeops.db"],
  ["MODEL_PROVIDER", "nebius"],
  ["SEARCH_PROVIDER", "tavily"],
  ["NEBIUS_API_KEY", cfg.NEBIUS_API_KEY || ""],
  ["NEBIUS_BASE_URL", cfg.NEBIUS_BASE_URL || "https://api.tokenfactory.us-central1.nebius.com/v1/"],
  ["NEBIUS_MODEL_PLAN", cfg.NEBIUS_MODEL_PLAN || "nvidia/Nemotron-3_5-Lightning"],
  ["NEBIUS_MODEL_FAST", cfg.NEBIUS_MODEL_FAST || "nvidia/Nemotron-3_5-Lightning"],
  ["TAVILY_API_KEY", cfg.TAVILY_API_KEY || ""],
  ["MCP_AUTH_TOKEN", MCP_AUTH_TOKEN],
  ["LOG_LEVEL", "info"],
  ["SEARCH_RESULT_LIMIT", "5"],
  ["SEARCH_ENABLED", "true"],
  ["MODEL_TIMEOUT_MS", "60000"],
  ["CORS_ORIGINS", WEB_DOMAIN]
];

const WEB_ENV = [
  ["NODE_ENV", "production"],
  ["PORT", "3000"],
  ["INTERNAL_API_URL", "http://" + (cfg.API_INTERNAL_HOST || "homeops-api") + ":8787"]
];

async function findApp(name) {
  const apps = await api("GET", "/api/v1/applications");
  return (Array.isArray(apps) ? apps : []).find((app) => app.name === name) || null;
}

async function ensureApp(name, options, envPairs) {
  let app = await findApp(name);
  if (!app) {
    console.log(APPLY ? "creating application " + name : "[dry-run] would create application " + name);
    if (APPLY) app = await api("POST", "/api/v1/applications/public", appPayload(name, options));
  } else {
    console.log("application exists: " + name + " (uuid " + app.uuid + ")");
  }
  if (!APPLY) return null;
  if (!app || !app.uuid) throw new Error("could not resolve application uuid for " + name);

  const data = envPairs.map(([key, value]) => ({ key, value: String(value), is_preview: false }));
  try {
    await api("POST", "/api/v1/applications/" + app.uuid + "/envs", { data });
    console.log("  env vars set: " + data.length);
  } catch (error) {
    console.log("  env bulk endpoint failed (" + String(error.message).slice(0, 120) + "), trying one by one");
    for (const pair of data) {
      await api("POST", "/api/v1/applications/" + app.uuid + "/envs", { key: pair.key, value: String(pair.value) });
    }
    console.log("  env vars set: " + data.length);
  }
  return app;
}

async function main() {
  console.log("Coolify: " + BASE);
  console.log("project " + PROJECT_UUID + " | server " + SERVER_UUID + " | repo " + GITHUB_REPO + "@" + BRANCH);
  console.log("mode: " + (APPLY ? "APPLY" : "dry run"));

  const apiApp = await ensureApp("homeops-api", { dockerfile: "/apps/api/Dockerfile", port: "8787" }, API_ENV);
  const webApp = await ensureApp("homeops-web", { dockerfile: "/apps/web/Dockerfile", port: "3000", domain: WEB_DOMAIN }, WEB_ENV);

  if (APPLY && apiApp) {
    try {
      await api("POST", "/api/v1/applications/" + apiApp.uuid + "/storages", {
        type: "persistent",
        name: "homeops-data",
        mount_path: "/data",
        host_path: null
      });
      console.log("  persistent volume /data created");
    } catch (error) {
      console.log("  volume: " + String(error.message).slice(0, 160));
    }
  }

  if (APPLY) {
    for (const app of [apiApp, webApp]) {
      if (!app) continue;
      try {
        await api("GET", "/api/v1/deploy?uuid=" + app.uuid + "&force=false");
        console.log("deploy triggered: " + app.name);
      } catch (error) {
        console.log("deploy failed for " + app.name + ": " + String(error.message).slice(0, 200));
      }
    }
    console.log("\nNext: watch the builds in the Coolify UI; the public URL is " + WEB_DOMAIN);
  }
}

main().catch((error) => {
  console.error("FAILED: " + (error && error.message ? error.message : String(error)));
  process.exit(1);
});
