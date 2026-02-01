/**
 * API module exports
 */

// Types
export type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  ProviderConfig,
  ProviderType,
  Result,
} from "./types";

// Base provider
export { BaseProvider, PROVIDER_CONFIGS, getEnabledProviders, getAllProviders } from "./BaseProvider";

// Provider implementations
export { GitHubModelsProvider } from "./providers/GitHubModelsProvider";
export { GhCopilotCliProvider } from "./providers/GhCopilotCliProvider";
export { GitHubCopilotEnterpriseProvider } from "./providers/GitHubCopilotEnterpriseProvider";

// Provider manager
export { ProviderManager } from "./ProviderManager";
export type { ProviderStatus } from "./ProviderManager";

// Legacy export for backwards compatibility
export { GitHubModelsClient } from "./GitHubModelsClient";
