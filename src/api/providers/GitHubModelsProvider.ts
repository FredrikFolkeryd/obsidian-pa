/**
 * GitHub Models Provider
 *
 * Implementation of BaseProvider for GitHub Models API.
 * This is the default provider for the plugin.
 */

import {
  BaseProvider,
  PROVIDER_CONFIGS,
} from "../BaseProvider";
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  Result,
} from "../types";

const API_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";
const MODELS_ENDPOINT = "https://models.inference.ai.azure.com/models";

/**
 * Patterns to identify embedding models (not for chat)
 */
const EMBEDDING_PATTERNS = [/embed/i, /embedding/i, /text-embedding/i];

/**
 * Check if a model is a chat model (not embedding)
 */
function isChatModel(name: string): boolean {
  return !EMBEDDING_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * API response types
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ApiError {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

/**
 * GitHub Models Provider implementation
 */
export class GitHubModelsProvider extends BaseProvider {
  private cachedModels: ModelInfo[] | null = null;

  public constructor() {
    super(PROVIDER_CONFIGS["github-models"]);
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false, // Could be added later
      supportsSystemPrompt: true,
      supportsFunctionCalling: false, // Not yet implemented
      supportsVision: false, // Some models support it, but not implemented
    };
  }

  protected onTokenChanged(): void {
    this.cachedModels = null;
  }

  public async validateToken(): Promise<Result<boolean>> {
    if (!this.token) {
      return { success: false, error: "No token provided" };
    }

    try {
      // Try to fetch models as a validation check
      const response = await fetch(MODELS_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        return { success: true, data: true };
      }

      if (response.status === 401) {
        return {
          success: false,
          error: "Invalid or expired token",
        };
      }

      if (response.status === 403) {
        const errorData = (await response.json()) as ApiError;
        if (errorData.error?.message?.toLowerCase().includes("models")) {
          return {
            success: false,
            error: "Token missing 'Models: Read' permission",
          };
        }
        return {
          success: false,
          error: `Access denied: ${errorData.error?.message || "Unknown error"}`,
        };
      }

      return {
        success: false,
        error: `Validation failed: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  public async getModels(): Promise<ModelInfo[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    if (!this.token) {
      return this.getDefaultModels();
    }

    try {
      const response = await fetch(MODELS_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        console.warn("[PA] Failed to fetch models:", response.status);
        return this.getDefaultModels();
      }

      const data = (await response.json()) as Array<{
        name: string;
        friendly_name?: string;
        model_version?: string;
      }>;

      const models: ModelInfo[] = data
        .filter((m) => isChatModel(m.name))
        .map((m) => ({
          id: m.name,
          name: m.friendly_name || m.name,
          provider: "github-models" as const,
          description: m.model_version ? `Version: ${m.model_version}` : undefined,
        }))
        .sort((a, b) => {
          // Sort: GPT models first, then by name
          const aIsGpt = a.id.toLowerCase().startsWith("gpt");
          const bIsGpt = b.id.toLowerCase().startsWith("gpt");
          if (aIsGpt && !bIsGpt) return -1;
          if (!aIsGpt && bIsGpt) return 1;
          return a.name.localeCompare(b.name);
        });

      this.cachedModels = models;
      return models;
    } catch (error) {
      console.warn("[PA] Error fetching models:", error);
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: "gpt-4o", name: "GPT-4o", provider: "github-models" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "github-models" },
    ];
  }

  public getDefaultModel(): string {
    return "gpt-4o";
  }

  public async chat(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<ChatResponse> {
    if (!this.token) {
      throw new Error("Not authenticated. Please add your GitHub token.");
    }

    const {
      model,
      systemPrompt,
      maxTokens = 2000,
      temperature = 0.7,
    } = options;

    // Build messages array with system prompt
    const apiMessages: ChatMessage[] = [];
    if (systemPrompt) {
      apiMessages.push({ role: "system", content: systemPrompt });
    }
    apiMessages.push(...messages);

    const requestBody = {
      model,
      messages: apiMessages,
      max_tokens: maxTokens,
      temperature,
    };

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        const errorMessage =
          errorData.error?.message ||
          `API error: ${response.status} ${response.statusText}`;

        if (response.status === 401) {
          throw new Error("Authentication failed. Your token may be invalid or expired.");
        }
        if (response.status === 403 && errorMessage.toLowerCase().includes("models")) {
          throw new Error(
            "Permission denied: Your token needs the 'Models: Read' permission."
          );
        }
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as ChatCompletionResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from AI model");
      }

      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason: data.choices[0].finish_reason,
      };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Network error: Unable to reach GitHub Models API");
      }
      throw error;
    }
  }
}
