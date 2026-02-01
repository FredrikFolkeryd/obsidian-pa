/**
 * GitHub Models API Client
 *
 * Handles communication with the GitHub Models API for chat completions.
 * Uses the Azure AI Inference REST API compatible endpoint.
 */

const API_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";
const MODELS_ENDPOINT = "https://models.inference.ai.azure.com/models";

/**
 * Model info from the API
 */
export interface ModelInfo {
  name: string;
  displayName: string;
  isChat: boolean;
}

/**
 * Patterns to identify embedding models (not for chat)
 */
const EMBEDDING_PATTERNS = [
  /embed/i,
  /embedding/i,
  /text-embedding/i,
];

/**
 * Check if a model is a chat model (not embedding)
 */
function isChatModel(name: string): boolean {
  return !EMBEDDING_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Chat completion options
 */
export interface ChatOptions {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
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

/**
 * API error response
 */
interface ApiError {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

/**
 * Rate limit tracking
 */
interface RateLimitInfo {
  requestsPerMinute: number;
  requestsPerDay: number;
  lastRequestTime: number;
  requestCountMinute: number;
  requestCountDay: number;
  dayStartTime: number;
}

/**
 * Client for GitHub Models API
 */
export class GitHubModelsClient {
  private token: string;
  private rateLimits: RateLimitInfo;
  private cachedModels: ModelInfo[] | null = null;

  public constructor(token: string) {
    this.token = token;
    this.rateLimits = {
      requestsPerMinute: 15,
      requestsPerDay: 150,
      lastRequestTime: 0,
      requestCountMinute: 0,
      requestCountDay: 0,
      dayStartTime: Date.now(),
    };
  }

  /**
   * Fetch available models from the API
   * Returns only chat models (filters out embedding models)
   */
  public async getAvailableModels(): Promise<ModelInfo[]> {
    // Return cached if available
    if (this.cachedModels) {
      return this.cachedModels;
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

      const data = (await response.json()) as Array<{ name: string; friendly_name?: string }>;

      // Filter to chat models only and map to ModelInfo
      const models: ModelInfo[] = data
        .filter((m) => isChatModel(m.name))
        .map((m) => ({
          name: m.name,
          displayName: m.friendly_name || m.name,
          isChat: true,
        }))
        .sort((a, b) => {
          // Sort: GPT models first, then by name
          const aIsGpt = a.name.toLowerCase().startsWith("gpt");
          const bIsGpt = b.name.toLowerCase().startsWith("gpt");
          if (aIsGpt && !bIsGpt) return -1;
          if (!aIsGpt && bIsGpt) return 1;
          return a.displayName.localeCompare(b.displayName);
        });

      this.cachedModels = models;
      return models;
    } catch (error) {
      console.warn("[PA] Error fetching models:", error);
      return this.getDefaultModels();
    }
  }

  /**
   * Get default models if API fetch fails
   */
  private getDefaultModels(): ModelInfo[] {
    return [
      { name: "gpt-4o", displayName: "GPT-4o", isChat: true },
      { name: "gpt-4o-mini", displayName: "GPT-4o Mini", isChat: true },
    ];
  }

  /**
   * Clear cached models (call when token changes)
   */
  public clearModelCache(): void {
    this.cachedModels = null;
  }

  /**
   * Send a chat completion request
   */
  public async chat(
    messages: Array<{ role: string; content: string }>,
    options: ChatOptions = {}
  ): Promise<string> {
    // Check rate limits
    this.checkRateLimits();

    const {
      model = "gpt-4o",
      systemPrompt,
      maxTokens = 2000,
      temperature = 0.7,
    } = options;

    // Build messages array with system prompt
    const apiMessages: ChatMessage[] = [];

    if (systemPrompt) {
      apiMessages.push({ role: "system", content: systemPrompt });
    }

    // Add conversation messages
    for (const msg of messages) {
      apiMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

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

      // Update rate limit tracking
      this.updateRateLimits();

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        const errorMessage = errorData.error?.message || `API error: ${response.status} ${response.statusText}`;
        
        // Provide clearer messages for common errors
        if (response.status === 401) {
          throw new Error("Authentication failed. Your token may be invalid or expired.");
        }
        if (response.status === 403 && errorMessage.toLowerCase().includes("models")) {
          throw new Error(
            "Permission denied: Your token needs the 'Models: Read' permission. " +
            "Edit your token at github.com/settings/tokens and add this permission."
          );
        }
        if (response.status === 403) {
          throw new Error(`Permission denied: ${errorMessage}`);
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

      return data.choices[0].message.content;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Network error: Unable to reach GitHub Models API");
      }
      throw error;
    }
  }

  /**
   * Check if we're within rate limits
   */
  private checkRateLimits(): void {
    const now = Date.now();

    // Reset minute counter if more than a minute has passed
    if (now - this.rateLimits.lastRequestTime > 60000) {
      this.rateLimits.requestCountMinute = 0;
    }

    // Reset day counter if more than a day has passed
    if (now - this.rateLimits.dayStartTime > 86400000) {
      this.rateLimits.requestCountDay = 0;
      this.rateLimits.dayStartTime = now;
    }

    // Check limits
    if (this.rateLimits.requestCountMinute >= this.rateLimits.requestsPerMinute) {
      const waitTime = Math.ceil((60000 - (now - this.rateLimits.lastRequestTime)) / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
    }

    if (this.rateLimits.requestCountDay >= this.rateLimits.requestsPerDay) {
      throw new Error("Daily rate limit exceeded. Please try again tomorrow.");
    }
  }

  /**
   * Update rate limit counters after a request
   */
  private updateRateLimits(): void {
    this.rateLimits.lastRequestTime = Date.now();
    this.rateLimits.requestCountMinute++;
    this.rateLimits.requestCountDay++;
  }

  /**
   * Get current rate limit status
   */
  public getRateLimitStatus(): {
    minuteRemaining: number;
    dayRemaining: number;
  } {
    return {
      minuteRemaining: this.rateLimits.requestsPerMinute - this.rateLimits.requestCountMinute,
      dayRemaining: this.rateLimits.requestsPerDay - this.rateLimits.requestCountDay,
    };
  }

  /**
   * Validate the token by making a test request
   */
  public async validateToken(): Promise<boolean> {
    try {
      await this.chat([{ role: "user", content: "Hello" }], {
        maxTokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }
}
