import OpenAI from "openai";

export interface ChatCompletionRequest {
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxOutputTokens: number;
  /** Ask the endpoint for a JSON object response. */
  jsonMode: boolean;
  timeoutMs: number;
}

export interface ChatCompletionResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface ChatClient {
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

/** Nebius Token Factory exposes an OpenAI-compatible API, so the OpenAI client is the documented path. */
export function createNebiusChatClient(config: { apiKey: string; baseUrl: string }): ChatClient {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl, maxRetries: 1 });

  return {
    async complete(request) {
      const response = await client.chat.completions.create(
        {
          model: request.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user }
          ],
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          ...(request.jsonMode ? { response_format: { type: "json_object" as const } } : {})
        },
        { timeout: request.timeoutMs }
      );

      const text = response.choices[0]?.message?.content ?? "";
      const usage = response.usage
        ? { inputTokens: response.usage.prompt_tokens ?? 0, outputTokens: response.usage.completion_tokens ?? 0 }
        : null;
      return { text, usage };
    }
  };
}

/** Some OpenAI-compatible deployments reject response_format; detect it so we can fall back once. */
export function isJsonModeUnsupported(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes("response_format") || message.includes("json_object") || message.includes("json mode");
}
