/**
 * GitHub Copilot Enterprise Provider (Stub)
 *
 * Placeholder implementation for future Copilot Enterprise API support.
 * This provider will enable access to premium models like Claude Opus
 * through GitHub Copilot Enterprise licenses.
 *
 * Status: NOT YET IMPLEMENTED
 * - Waiting for GitHub to expose a programmatic API for Copilot Enterprise
 * - May require OAuth flow or different authentication mechanism
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
 * GitHub Copilot Enterprise Provider
 *
 * TODO: Implement when API becomes available
 * Expected features:
 * - Access to Claude Opus, Claude Sonnet, and other premium models
 * - Higher rate limits than free GitHub Models
 * - Enterprise-grade SLA and support
 */
export class GitHubCopilotEnterpriseProvider extends BaseProvider {
  public constructor() {
    super({
      ...PROVIDER_CONFIGS["github-copilot-enterprise"],
      enabled: false, // Explicitly disabled until implemented
    });
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true, // Expected to support
      supportsSystemPrompt: true,
      supportsFunctionCalling: true, // Expected to support
      supportsVision: true, // Expected to support
    };
  }

  public validateToken(): Promise<Result<boolean>> {
    return Promise.resolve({
      success: false,
      error:
        "GitHub Copilot Enterprise API is not yet available. " +
        "Check with your organization admin for updates.",
    });
  }

  public getModels(): Promise<ModelInfo[]> {
    // Placeholder: expected models when available
    return Promise.resolve([
      {
        id: "claude-opus-4.5",
        name: "Claude Opus 4.5",
        provider: "github-copilot-enterprise",
        description: "Most capable Claude model",
      },
      {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        provider: "github-copilot-enterprise",
        description: "Balanced performance and speed",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "github-copilot-enterprise",
        description: "OpenAI GPT-4 Omni",
      },
      {
        id: "o1",
        name: "o1",
        provider: "github-copilot-enterprise",
        description: "OpenAI reasoning model",
      },
    ]);
  }

  public getDefaultModel(): string {
    return "claude-opus-4.5";
  }

  public chat(
    _messages: ChatMessage[],
    _options: ChatOptions
  ): Promise<ChatResponse> {
    return Promise.reject(new Error(
      "GitHub Copilot Enterprise API is not yet implemented. " +
        "Please use GitHub Models for now, or contact your organization " +
        "admin to request programmatic API access to Copilot Enterprise."
    ));
  }
}

/**
 * Notes for future implementation:
 *
 * Possible authentication methods:
 * 1. OAuth device flow (similar to `gh auth login`)
 * 2. GitHub App installation token
 * 3. Fine-grained PAT with Copilot scope (if added)
 *
 * Possible endpoints:
 * - https://api.github.com/copilot/...
 * - https://copilot.github.com/api/...
 * - Via VS Code extension API bridge
 *
 * Reference:
 * - Watch GitHub changelog for Copilot API announcements
 * - Check: https://docs.github.com/en/copilot/using-github-copilot
 */
