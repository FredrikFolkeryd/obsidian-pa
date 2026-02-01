/**
 * Shared types for AI providers
 */

/**
 * Chat message format (OpenAI-compatible)
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

/**
 * Supported provider types
 */
export type ProviderType =
  | "github-models"
  | "gh-copilot-cli"
  | "github-copilot-enterprise"
  | "openai"
  | "azure-openai"
  | "aws-bedrock";

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: ProviderType;
  name: string;
  description: string;
  enabled: boolean;
  endpoint?: string;
  requiresToken: boolean;
  tokenInstructions?: string;
}

/**
 * Chat completion options
 */
export interface ChatOptions {
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Chat completion response
 */
export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsSystemPrompt: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
}

/**
 * Result type for operations that can fail
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}
