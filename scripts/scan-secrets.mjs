#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "coverage", ".data", "playwright-report"]);
const SKIP_FILES = new Set([".env"]);
const TEXT_EXTENSIONS = /(?:\.ts|\.tsx|\.js|\.mjs|\.cjs|\.json|\.md|\.yml|\.yaml|\.sql|\.css|\.toml|\.example|\.sh)$/i;

const PATTERNS = [
  { name: "Tavily key", regex: /tvly-[A-Za-z0-9]{10,}/ },
  { name: "OpenAI-style key", regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  // Keys look like real credentials; empty or placeholder values in .env.example do not match.
  { name: "Assigned provider key", regex: /(?:NEBIUS_API_KEY|TAVILY_API_KEY)\s*=\s*["']?[A-Za-z0-9_\-]{20,}["']?/ }
];

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full);
      continue;
    }
    if (!TEXT_EXTENSIONS.test(entry)) continue;
    const content = readFileSync(full, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({ file: relative(ROOT, full), line: index + 1, name: pattern.name });
        }
      }
    });
  }
}

walk(ROOT);

if (findings.length > 0) {
  console.error("Potential secrets found in tracked files:");
  for (const finding of findings) console.error(`  ${finding.file}:${finding.line} — ${finding.name}`);
  console.error("\nNever commit credentials. Use .env (git-ignored) or platform environment variables.");
  process.exit(1);
}

console.log("scan:secrets — no credentials found in tracked files.");
