/**
 * Base AI Provider Interface
 *
 * Abstract interface that all AI providers must implement.
 * This allows the plugin to support multiple AI backends.
 */

import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  ProviderConfig,
  ProviderType,
  Result,
} from "./types";

/**
 * Abstract base class for AI providers
 */
export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected token: string | null = null;

  public constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Get the provider type
   */
  public get type(): ProviderType {
    return this.config.type;
  }

  /**
   * Get the provider display name
   */
  public get name(): string {
    return this.config.name;
  }

  /**
   * Get provider description
   */
  public get description(): string {
    return this.config.description;
  }

  /**
   * Check if this provider is enabled
   */
  public get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set the authentication token
   */
  public setToken(token: string): void {
    this.token = token;
    this.onTokenChanged();
  }

  /**
   * Clear the authentication token
   */
  public clearToken(): void {
    this.token = null;
    this.onTokenChanged();
  }

  /**
   * Check if provider is authenticated
   */
  public isAuthenticated(): boolean {
    return this.token !== null && this.token.length > 0;
  }

  /**
   * Hook called when token changes - override to clear caches etc.
   */
  protected onTokenChanged(): void {
    // Override in subclasses if needed
  }

  /**
   * Get provider capabilities
   */
  public abstract getCapabilities(): ProviderCapabilities;

  /**
   * Validate the current token
   */
  public abstract validateToken(): Promise<Result<boolean>>;

  /**
   * Get available models
   */
  public abstract getModels(): Promise<ModelInfo[]>;

  /**
   * Send a chat completion request
   */
  public abstract chat(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<ChatResponse>;

  /**
   * Get default model for this provider
   */
  public abstract getDefaultModel(): string;
}

/**
 * Registry of available providers
 */
export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  "github-models": {
    type: "github-models",
    name: "GitHub Models",
    description: "Free tier access to GPT-4o, Llama, Mistral, and more",
    enabled: true,
    endpoint: "https://models.inference.ai.azure.com",
    requiresToken: true,
    tokenInstructions:
      "Create a Personal Access Token at github.com/settings/tokens with 'Models: Read' permission",
  },
  "github-copilot-enterprise": {
    type: "github-copilot-enterprise",
    name: "GitHub Copilot Enterprise",
    description: "Premium models including Claude Opus via Copilot Enterprise",
    enabled: false, // Not yet implemented
    requiresToken: true,
    tokenInstructions:
      "Requires Copilot Enterprise license. Contact your organization admin for API access.",
  },
  anthropic: {
    type: "anthropic",
    name: "Anthropic",
    description: "Direct access to Claude models",
    enabled: false, // Not yet implemented
    endpoint: "https://api.anthropic.com/v1",
    requiresToken: true,
    tokenInstructions: "Get your API key from console.anthropic.com",
  },
  openai: {
    type: "openai",
    name: "OpenAI",
    description: "Direct access to GPT models",
    enabled: false, // Not yet implemented
    endpoint: "https://api.openai.com/v1",
    requiresToken: true,
    tokenInstructions: "Get your API key from platform.openai.com",
  },
  "azure-openai": {
    type: "azure-openai",
    name: "Azure OpenAI",
    description: "Enterprise Azure OpenAI deployment",
    enabled: false, // Not yet implemented
    requiresToken: true,
    tokenInstructions: "Requires Azure OpenAI resource. Get endpoint and key from Azure Portal.",
  },
  "aws-bedrock": {
    type: "aws-bedrock",
    name: "AWS Bedrock",
    description: "Access to Claude, Llama, and other models via AWS",
    enabled: false, // Not yet implemented
    requiresToken: true,
    tokenInstructions: "Requires AWS credentials with Bedrock access",
  },
};

/**
 * Get list of enabled providers
 */
export function getEnabledProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter((p) => p.enabled);
}

/**
 * Get list of all providers (for settings UI)
 */
export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS);
}
