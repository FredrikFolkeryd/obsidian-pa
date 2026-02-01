/**
 * Provider Manager
 *
 * Manages multiple AI providers and handles provider selection,
 * authentication, and routing of requests to the appropriate provider.
 */

import type { BaseProvider } from "./BaseProvider";
import { PROVIDER_CONFIGS } from "./BaseProvider";
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderType,
  Result,
} from "./types";
import { GitHubModelsProvider } from "./providers/GitHubModelsProvider";
import { GhCopilotCliProvider } from "./providers/GhCopilotCliProvider";
import { GitHubCopilotEnterpriseProvider } from "./providers/GitHubCopilotEnterpriseProvider";

/**
 * Provider with authentication status
 */
export interface ProviderStatus {
  type: ProviderType;
  name: string;
  description: string;
  enabled: boolean;
  implemented: boolean;
  authenticated: boolean;
}

/**
 * Manager for AI providers
 */
export class ProviderManager {
  private providers: Map<ProviderType, BaseProvider> = new Map();
  private activeProvider: ProviderType = "github-models";

  public constructor() {
    // Initialize all providers
    this.providers.set("github-models", new GitHubModelsProvider());
    this.providers.set("gh-copilot-cli", new GhCopilotCliProvider());
    this.providers.set("github-copilot-enterprise", new GitHubCopilotEnterpriseProvider());
    // Add more providers here as they're implemented
  }

  /**
   * Get the currently active provider
   */
  public getActiveProvider(): BaseProvider | null {
    return this.providers.get(this.activeProvider) || null;
  }

  /**
   * Get a specific provider by type
   */
  public getProvider(type: ProviderType): BaseProvider | null {
    return this.providers.get(type) || null;
  }

  /**
   * Set the active provider
   */
  public setActiveProvider(type: ProviderType): boolean {
    const provider = this.providers.get(type);
    if (!provider) {
      return false;
    }
    if (!provider.enabled) {
      console.warn(`[PA] Provider ${type} is not enabled`);
      return false;
    }
    this.activeProvider = type;
    return true;
  }

  /**
   * Get the active provider type
   */
  public getActiveProviderType(): ProviderType {
    return this.activeProvider;
  }

  /**
   * Set token for a specific provider
   */
  public setProviderToken(type: ProviderType, token: string): boolean {
    const provider = this.providers.get(type);
    if (!provider) {
      return false;
    }
    provider.setToken(token);
    return true;
  }

  /**
   * Clear token for a specific provider
   */
  public clearProviderToken(type: ProviderType): void {
    const provider = this.providers.get(type);
    if (provider) {
      provider.clearToken();
    }
  }

  /**
   * Validate token for a specific provider
   */
  public async validateProviderToken(type: ProviderType): Promise<Result<boolean>> {
    const provider = this.providers.get(type);
    if (!provider) {
      return { success: false, error: "Provider not found" };
    }
    return provider.validateToken();
  }

  /**
   * Get status of all providers
   */
  public getProviderStatuses(): ProviderStatus[] {
    const statuses: ProviderStatus[] = [];

    for (const [type, config] of Object.entries(PROVIDER_CONFIGS)) {
      const provider = this.providers.get(type as ProviderType);
      statuses.push({
        type: type as ProviderType,
        name: config.name,
        description: config.description,
        enabled: config.enabled,
        implemented: provider !== undefined,
        authenticated: provider?.isAuthenticated() || false,
      });
    }

    return statuses;
  }

  /**
   * Get available models from the active provider
   */
  public async getModels(): Promise<ModelInfo[]> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return [];
    }
    return provider.getModels();
  }

  /**
   * Get models from a specific provider
   */
  public async getModelsForProvider(type: ProviderType): Promise<ModelInfo[]> {
    const provider = this.providers.get(type);
    if (!provider) {
      return [];
    }
    return provider.getModels();
  }

  /**
   * Send a chat request to the active provider
   */
  public async chat(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<ChatResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error("No active provider configured");
    }
    if (!provider.isAuthenticated()) {
      throw new Error(`Please authenticate with ${provider.name} first`);
    }
    return provider.chat(messages, options);
  }

  /**
   * Get the default model for the active provider
   */
  public getDefaultModel(): string {
    const provider = this.getActiveProvider();
    if (!provider) {
      return "gpt-4o";
    }
    return provider.getDefaultModel();
  }

  /**
   * Check if the active provider is authenticated
   */
  public isAuthenticated(): boolean {
    const provider = this.getActiveProvider();
    return provider?.isAuthenticated() || false;
  }

  /**
   * Get list of enabled provider types
   */
  public getEnabledProviderTypes(): ProviderType[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.enabled)
      .map(([type, _]) => type);
  }
}
