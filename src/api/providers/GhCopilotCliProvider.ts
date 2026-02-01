/**
 * GitHub Copilot CLI Provider
 *
 * Invokes the gh-copilot CLI extension for chat completions.
 * Requires: gh CLI with gh-copilot extension installed and authenticated.
 *
 * SECURITY MODEL:
 * - Authentication: Delegates to `gh auth` stored credentials (system keychain)
 * - No tokens: This provider never receives, stores, or transmits credentials
 * - Process isolation: Each CLI invocation is a separate process
 * - Shell safety: Uses spawn with shell:false to prevent injection
 */

import { spawn, type ChildProcess, execSync } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import { existsSync } from "fs";

import { BaseProvider, PROVIDER_CONFIGS } from "../BaseProvider";
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  Result,
} from "../types";

const execAsync = promisify(exec);

/**
 * Common gh CLI installation paths by platform
 * GUI apps on macOS don't inherit shell PATH, so we check known locations
 */
const GH_CLI_PATHS: Record<string, string[]> = {
  darwin: [
    "/opt/homebrew/bin/gh", // Homebrew on Apple Silicon
    "/usr/local/bin/gh", // Homebrew on Intel Mac
    "/usr/bin/gh", // System install
  ],
  linux: [
    "/usr/bin/gh",
    "/usr/local/bin/gh",
    "/snap/bin/gh", // Snap package
    "/home/linuxbrew/.linuxbrew/bin/gh", // Linuxbrew
  ],
  win32: [
    "C:\\Program Files\\GitHub CLI\\gh.exe",
    "C:\\Program Files (x86)\\GitHub CLI\\gh.exe",
  ],
};

/**
 * CLI status information
 */
interface CliStatus {
  ghInstalled: boolean;
  ghPath: string | null;
  copilotExtensionInstalled: boolean;
  authenticated: boolean;
  authError?: string;
}

/**
 * Known models available via gh copilot CLI
 * From: gh copilot -- --help (model choices)
 */
const KNOWN_MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "gh-copilot-cli",
    description: "Balanced Claude model - good for most tasks",
  },
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "gh-copilot-cli",
    description: "Most capable Claude model - best for complex tasks",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "gh-copilot-cli",
    description: "Latest Claude Sonnet - fast and capable",
  },
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "gh-copilot-cli",
    description: "Fastest Claude model",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "gh-copilot-cli",
    description: "OpenAI GPT-4 Turbo",
  },
  {
    id: "gpt-5",
    name: "GPT-5",
    provider: "gh-copilot-cli",
    description: "Latest OpenAI model",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "gh-copilot-cli",
    description: "Efficient OpenAI model",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "gh-copilot-cli",
    description: "OpenAI GPT-5.1",
  },
  {
    id: "gpt-5.1-codex",
    name: "GPT-5.1 Codex",
    provider: "gh-copilot-cli",
    description: "OpenAI coding model",
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "gh-copilot-cli",
    description: "Latest OpenAI GPT",
  },
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro (Preview)",
    provider: "gh-copilot-cli",
    description: "Google's latest Gemini model",
  },
];

/**
 * GitHub Copilot CLI Provider implementation
 */
export class GhCopilotCliProvider extends BaseProvider {
  private cliStatusCache: CliStatus | null = null;
  private cliStatusCacheTime = 0;
  private readonly CLI_CACHE_TTL = 60000; // 1 minute
  private activeProcess: ChildProcess | null = null;

  public constructor() {
    super(PROVIDER_CONFIGS["gh-copilot-cli"]);
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false, // CLI returns full response
      supportsSystemPrompt: true, // Prepend to prompt
      supportsFunctionCalling: false, // Not supported via CLI
      supportsVision: false, // Not supported via CLI
    };
  }

  /**
   * Override: This provider doesn't use tokens - uses gh auth
   */
  public override isAuthenticated(): boolean {
    // Use cached status for synchronous check
    return this.cliStatusCache?.authenticated ?? false;
  }

  /**
   * Override: No token needed - uses gh auth
   */
  public override setToken(_token: string): void {
    // No-op: this provider uses gh auth, not tokens
    console.info("[PA] GhCopilotCliProvider: setToken ignored - uses gh auth");
  }

  /**
   * Override: No token to clear
   */
  public override clearToken(): void {
    // No-op: clear the cache instead
    this.cliStatusCache = null;
  }

  /**
   * Validate by checking gh auth status
   */
  public async validateToken(): Promise<Result<boolean>> {
    const status = await this.getCachedCliStatus();

    if (!status.ghInstalled) {
      return {
        success: false,
        error: "GitHub CLI (gh) is not installed. Install from https://cli.github.com/",
      };
    }

    if (!status.copilotExtensionInstalled) {
      return {
        success: false,
        error:
          "gh-copilot extension not installed. Run: gh extension install github/gh-copilot",
      };
    }

    if (!status.authenticated) {
      return {
        success: false,
        error: `Not authenticated with GitHub CLI. Run: gh auth login${status.authError ? ` (${status.authError})` : ""}`,
      };
    }

    return { success: true, data: true };
  }

  /**
   * Get available models (hardcoded list)
   */
  public getModels(): Promise<ModelInfo[]> {
    return Promise.resolve(KNOWN_MODELS);
  }

  /**
   * Get default model
   */
  public getDefaultModel(): string {
    return "claude-opus-4.5";
  }

  /**
   * Send a chat request via gh copilot CLI
   */
  public async chat(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<ChatResponse> {
    // Verify CLI is ready
    const status = await this.getCachedCliStatus();
    if (!status.authenticated) {
      throw new Error("GitHub CLI not authenticated. Run: gh auth login");
    }

    const { model, systemPrompt } = options;
    const prompt = this.formatMessagesAsPrompt(messages, systemPrompt);

    try {
      const result = await this.invokeCopilotCli(prompt, model);

      return {
        content: result,
        model: model,
        // CLI doesn't provide usage stats
        usage: undefined,
        finishReason: "stop",
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Clean up on unload
   */
  public onUnload(): void {
    if (this.activeProcess) {
      this.activeProcess.kill("SIGTERM");
      this.activeProcess = null;
    }
  }

  /**
   * Get CLI status with caching
   */
  private async getCachedCliStatus(): Promise<CliStatus> {
    const now = Date.now();
    if (this.cliStatusCache && now - this.cliStatusCacheTime < this.CLI_CACHE_TTL) {
      return this.cliStatusCache;
    }
    this.cliStatusCache = await this.checkCliStatus();
    this.cliStatusCacheTime = now;
    return this.cliStatusCache;
  }

  /**
   * Force refresh CLI status (called from settings UI)
   */
  public async refreshCliStatus(): Promise<CliStatus> {
    this.cliStatusCache = null;
    return this.getCachedCliStatus();
  }

  /**
   * Check if gh CLI and copilot are available
   * Note: gh copilot is now a built-in command in gh CLI v2.40+, not an extension
   */
  private async checkCliStatus(): Promise<CliStatus> {
    const status: CliStatus = {
      ghInstalled: false,
      ghPath: null,
      copilotExtensionInstalled: false,
      authenticated: false,
    };

    // Find gh CLI - check known paths first (GUI apps don't have shell PATH)
    const ghPath = this.findGhCliPath();
    if (!ghPath) {
      return status;
    }

    status.ghInstalled = true;
    status.ghPath = ghPath;

    // Check if gh copilot is available (built-in or extension)
    // In gh CLI v2.40+, copilot is a built-in command, not an extension
    try {
      // Try running gh copilot --help to see if it's available
      await execAsync(`"${ghPath}" copilot --help`, {
        timeout: 10000, // May need to download on first run
      });
      status.copilotExtensionInstalled = true;
    } catch {
      // Copilot not available - check if it's an extension (older gh versions)
      try {
        const { stdout: extOutput } = await execAsync(`"${ghPath}" extension list`, {
          timeout: 5000,
        });
        status.copilotExtensionInstalled = extOutput.includes("github/gh-copilot");
      } catch {
        // Neither built-in nor extension
        return status;
      }
    }

    try {
      // Check authentication
      const { stdout: authOutput, stderr: authStderr } = await execAsync(
        `"${ghPath}" auth status`,
        { timeout: 5000 }
      );
      const combined = authOutput + authStderr;
      status.authenticated =
        combined.includes("Logged in") || combined.includes("✓ Logged in");
    } catch (error) {
      // gh auth status returns non-zero when not logged in
      status.authError = error instanceof Error ? error.message : "Auth check failed";
    }

    return status;
  }

  /**
   * Find the gh CLI binary path
   * GUI apps (like Obsidian) don't inherit shell PATH, so we check known locations
   */
  private findGhCliPath(): string | null {
    const platform = process.platform;
    const knownPaths = GH_CLI_PATHS[platform] || [];

    // First check known installation paths (most reliable for GUI apps)
    for (const p of knownPaths) {
      if (existsSync(p)) {
        return p;
      }
    }

    // Fallback: try to find in PATH (works if launched from terminal)
    try {
      const whichCmd = platform === "win32" ? "where gh" : "which gh";
      const result = execSync(whichCmd, { timeout: 2000, encoding: "utf8" });
      const foundPath = result.trim().split("\n")[0];
      if (foundPath && existsSync(foundPath)) {
        return foundPath;
      }
    } catch {
      // Not in PATH
    }

    return null;
  }

  /**
   * Convert chat messages to a single prompt string
   */
  private formatMessagesAsPrompt(
    messages: ChatMessage[],
    systemPrompt?: string
  ): string {
    const parts: string[] = [];

    // Add system prompt as context
    if (systemPrompt) {
      parts.push(`<system>\n${systemPrompt}\n</system>\n`);
    }

    // Add conversation history
    for (const msg of messages) {
      switch (msg.role) {
        case "system":
          parts.push(`<system>\n${msg.content}\n</system>\n`);
          break;
        case "user":
          parts.push(`User: ${msg.content}\n`);
          break;
        case "assistant":
          parts.push(`Assistant: ${msg.content}\n`);
          break;
      }
    }

    // Add instruction for response
    parts.push("\nPlease respond to the user's latest message.");

    return parts.join("\n");
  }

  /**
   * Invoke the gh copilot CLI
   *
   * SECURITY: Uses spawn with shell:false to prevent injection
   */
  private async invokeCopilotCli(prompt: string, model: string): Promise<string> {
    // Prevent concurrent invocations
    if (this.activeProcess) {
      throw new Error("A request is already in progress. Please wait.");
    }

    // Get the gh path from cache (should already be set from validation)
    const ghPath = this.cliStatusCache?.ghPath || this.findGhCliPath();
    if (!ghPath) {
      throw new Error("GitHub CLI not found. Install from https://cli.github.com/");
    }

    return new Promise((resolve, reject) => {
      // Arguments as array - never interpreted by shell
      const args = ["copilot", "-p", prompt, "--model", model];

      // CRITICAL: shell: false prevents shell interpretation
      // Use full path to gh binary (GUI apps don't have shell PATH)
      const child = spawn(ghPath, args, {
        shell: false, // <-- CRITICAL SECURITY SETTING
        timeout: 120000, // 2 minute timeout
        windowsHide: true, // Prevent window popup on Windows
      });

      this.activeProcess = child;

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(this.sanitiseErrorMessage(stderr || stdout, code)));
        }
      });

      child.on("error", (err) => {
        this.activeProcess = null;
        reject(new Error(this.sanitiseErrorMessage(err.message, null)));
      });
    });
  }

  /**
   * Sanitise error messages to avoid leaking sensitive info
   */
  private sanitiseErrorMessage(rawError: string, exitCode: number | null): string {
    const patterns: Array<[RegExp, string]> = [
      [
        /command not found|not recognized/i,
        "GitHub CLI not found. Install from https://cli.github.com/",
      ],
      [
        /gh.copilot.*not installed|extension.*not found/i,
        "gh-copilot extension not installed. Run: gh extension install github/gh-copilot",
      ],
      [
        /401|unauthorized|not logged in|auth.*failed/i,
        "Not authenticated with GitHub. Run: gh auth login",
      ],
      [/403|forbidden|access denied|permission/i, "Access denied. Ensure you have a valid Copilot licence."],
      [/429|rate.limit|too many requests/i, "Rate limit exceeded. Please wait a moment and try again."],
      [
        /timeout|timed out|deadline exceeded/i,
        "Request timed out. Try a shorter prompt or simpler question.",
      ],
      [
        /model.*not found|invalid model|unknown model/i,
        "Selected model is not available. Please choose a different model.",
      ],
      [
        /network|connection|ENOTFOUND|ECONNREFUSED/i,
        "Network error. Please check your internet connection.",
      ],
    ];

    const lowerError = rawError.toLowerCase();
    for (const [pattern, safeMessage] of patterns) {
      if (pattern.test(lowerError)) {
        return safeMessage;
      }
    }

    // Generic fallback - never expose raw error
    const exitInfo = exitCode !== null ? ` (exit code: ${exitCode})` : "";
    return `CLI operation failed${exitInfo}. Check that gh copilot is properly configured.`;
  }

  /**
   * Wrap errors with user-friendly messages
   */
  private wrapError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error(String(error));
    }
    // Error is already wrapped by sanitiseErrorMessage in most cases
    return error;
  }
}
