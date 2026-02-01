/**
 * Anthropic Provider (Stub)
 *
 * Placeholder implementation for direct Anthropic API support.
 * Enables access to Claude models via Anthropic's API directly.
 *
 * Status: NOT YET IMPLEMENTED
 */

import { BaseProvider, PROVIDER_CONFIGS } from "../BaseProvider";
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  Result,
} from "../types";

/**
 * Anthropic Provider
 *
 * TODO: Implement when needed
 * - Uses Anthropic's native API format (slightly different from OpenAI)
 * - Requires Anthropic API key from console.anthropic.com
 */
export class AnthropicProvider extends BaseProvider {
  public constructor() {
    super({
      ...PROVIDER_CONFIGS["anthropic"],
      enabled: false,
    });
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsSystemPrompt: true, // Uses separate system parameter
      supportsFunctionCalling: true, // Tool use
      supportsVision: true,
    };
  }

  public async validateToken(): Promise<Result<boolean>> {
    return {
      success: false,
      error: "Anthropic provider is not yet implemented.",
    };
  }

  public async getModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        provider: "anthropic",
        description: "Most capable, best for complex tasks",
        contextWindow: 200000,
        maxOutputTokens: 32000,
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        provider: "anthropic",
        description: "Balanced performance",
        contextWindow: 200000,
        maxOutputTokens: 16000,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        provider: "anthropic",
        description: "Fast and efficient",
        contextWindow: 200000,
        maxOutputTokens: 8192,
      },
    ];
  }

  public getDefaultModel(): string {
    return "claude-sonnet-4-20250514";
  }

  public async chat(
    _messages: ChatMessage[],
    _options: ChatOptions
  ): Promise<ChatResponse> {
    throw new Error(
      "Anthropic provider is not yet implemented. " +
        "Please use GitHub Models for now."
    );
  }
}

/**
 * Implementation notes:
 *
 * Anthropic API differs from OpenAI:
 * - System prompt is a separate field, not a message
 * - Different response format
 * - Uses "human" and "assistant" roles (map from "user")
 *
 * Endpoint: https://api.anthropic.com/v1/messages
 *
 * Headers:
 * - x-api-key: <API_KEY>
 * - anthropic-version: 2023-06-01
 * - content-type: application/json
 *
 * Request body:
 * {
 *   model: "claude-opus-4-20250514",
 *   max_tokens: 1024,
 *   system: "System prompt here",
 *   messages: [
 *     { role: "user", content: "Hello" }
 *   ]
 * }
 */
