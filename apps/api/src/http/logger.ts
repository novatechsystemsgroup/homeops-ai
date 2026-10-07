import pino, { type Logger } from "pino";

/** Secrets must never reach the logs; the redactor is the last line of defence. */
export function createLogger(level = "info"): Logger {
  return pino({
    level,
    redact: {
      paths: ["req.headers.authorization", "authorization", "*.apiKey", "*.api_key", "apiKey", "NEBIUS_API_KEY", "TAVILY_API_KEY"],
      censor: "[redacted]"
    },
    base: { service: "homeops-ai" }
  });
}

export type { Logger };
