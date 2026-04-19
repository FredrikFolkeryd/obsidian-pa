/**
 * GitHub Copilot CLI Provider
 *
 * Invokes the standalone GitHub Copilot CLI for chat completions.
 * Requires: copilot CLI installed and authenticated.
 *
 * Installation: brew install copilot-cli (macOS/Linux)
 *               winget install GitHub.Copilot (Windows)
 *               npm install -g @github/copilot
 *
 * SECURITY MODEL:
 * - Authentication: Delegates to copilot's OAuth or PAT credentials
 * - No tokens: This provider never receives, stores, or transmits credentials
 * - Process isolation: Each CLI invocation is a separate process
 * - Shell safety: Uses spawn with shell:false to prevent injection
 */

import { spawn, type ChildProcess, execSync } from "child_process";
import { existsSync } from "fs";

import { BaseProvider, PROVIDER_CONFIGS } from "../BaseProvider";
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  Result,
  StreamCallback,
} from "../types";
import { getShellEnv } from "../../utils/shellEnv";

/**
 * Common copilot CLI installation paths by platform
 * GUI apps on macOS don't inherit shell PATH, so we check known locations
 */
const COPILOT_CLI_PATHS: Record<string, string[]> = {
  darwin: [
    "/opt/homebrew/bin/copilot", // Homebrew on Apple Silicon
    "/usr/local/bin/copilot", // Homebrew on Intel Mac / npm global
    `${process.env.HOME}/.local/bin/copilot`, // Install script default
  ],
  linux: [
    "/usr/local/bin/copilot", // npm global / install script as root
    `${process.env.HOME}/.local/bin/copilot`, // Install script default
    "/usr/bin/copilot",
  ],
  win32: [
    "C:\\Program Files\\GitHub Copilot\\copilot.exe",
    `${process.env.LOCALAPPDATA}\\Programs\\GitHub Copilot\\copilot.exe`,
  ],
};

/**
 * CLI status information
 */
interface CliStatus {
  cliInstalled: boolean;
  cliPath: string | null;
  authenticated: boolean;
  authError?: string;
  version?: string;
}

/**
 * Known models available via copilot CLI
 * From: copilot --help (model choices)
 */
const KNOWN_MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "gh-copilot-cli",
    description: "Balanced Claude model - good for most tasks",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "gh-copilot-cli",
    description: "Latest Claude Sonnet - fast and capable",
  },
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "gh-copilot-cli",
    description: "Most capable Claude model - best for complex tasks",
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
    id: "gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    provider: "gh-copilot-cli",
    description: "Efficient OpenAI coding model",
  },
  {
    id: "gpt-5.1-codex-max",
    name: "GPT-5.1 Codex Max",
    provider: "gh-copilot-cli",
    description: "Most capable OpenAI coding model",
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "gh-copilot-cli",
    description: "Latest OpenAI GPT",
  },
  {
    id: "gpt-5.2-codex",
    name: "GPT-5.2 Codex",
    provider: "gh-copilot-cli",
    description: "Latest OpenAI coding model",
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
  private vaultBasePath: string | null = null;

  public constructor() {
    super(PROVIDER_CONFIGS["gh-copilot-cli"]);
  }

  /**
   * Set the vault base path used to scope CLI file permissions.
   */
  public setVaultBasePath(vaultBasePath: string | null): void {
    const trimmedPath = vaultBasePath?.trim();
    this.vaultBasePath = trimmedPath ? trimmedPath : null;
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true, // CLI supports streaming output
      supportsSystemPrompt: true, // Prepend to prompt
      supportsFunctionCalling: false, // Not supported via CLI
      supportsVision: false, // Not supported via CLI
    };
  }

  /**
   * Override: This provider doesn't use tokens - uses copilot auth
   */
  public override isAuthenticated(): boolean {
    // Use cached status for synchronous check
    return this.cliStatusCache?.authenticated ?? false;
  }

  /**
   * Override: No token needed - uses copilot auth
   */
  public override setToken(_token: string): void {
    // No-op: this provider uses copilot's own auth, not tokens
    console.info("[PA] GhCopilotCliProvider: setToken ignored - uses copilot auth");
  }

  /**
   * Override: No token to clear
   */
  public override clearToken(): void {
    // No-op: clear the cache instead
    this.cliStatusCache = null;
  }

  /**
   * Validate by checking copilot CLI status
   */
  public async validateToken(): Promise<Result<boolean>> {
    const status = await this.getCachedCliStatus();

    if (!status.cliInstalled) {
      return {
        success: false,
        error:
          "GitHub Copilot CLI not installed. Install with: brew install copilot-cli",
      };
    }

    if (!status.authenticated) {
      return {
        success: false,
        error: `Not authenticated with Copilot CLI. Run: copilot${status.authError ? ` (${status.authError})` : ""}`,
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
    return "claude-sonnet-4";
  }

  /**
   * Send a chat request via copilot CLI
   */
  public async chat(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<ChatResponse> {
    // Verify CLI is ready
    const status = await this.getCachedCliStatus();
    if (!status.authenticated) {
      throw new Error("Copilot CLI not authenticated. Run: copilot");
    }

    const { model, systemPrompt } = options;
    const prompt = this.formatMessagesAsPrompt(messages, systemPrompt);

    try {
      const result = await this.invokeCopilotCli(prompt, model, false);

      return {
        content: result,
        model: model,
        // CLI provides usage info but we'd need to parse it
        usage: undefined,
        finishReason: "stop",
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Send a streaming chat request via copilot CLI
   */
  public override async chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
    onChunk: StreamCallback
  ): Promise<ChatResponse> {
    // Verify CLI is ready
    const status = await this.getCachedCliStatus();
    if (!status.authenticated) {
      throw new Error("Copilot CLI not authenticated. Run: copilot");
    }

    const { model, systemPrompt } = options;
    const prompt = this.formatMessagesAsPrompt(messages, systemPrompt);

    try {
      const result = await this.invokeCopilotCliStreaming(prompt, model, onChunk);

      return {
        content: result,
        model: model,
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
   * Check if copilot CLI is available and authenticated
   */
  private async checkCliStatus(): Promise<CliStatus> {
    const status: CliStatus = {
      cliInstalled: false,
      cliPath: null,
      authenticated: false,
    };

    // Find copilot CLI - check known paths first (GUI apps don't have shell PATH)
    const cliPath = this.findCopilotCliPath();
    if (!cliPath) {
      return status;
    }

    status.cliInstalled = true;
    status.cliPath = cliPath;

    // Check version to verify it works — use spawn (same env as actual calls)
    try {
      const { stdout } = await this.spawnGetOutput(cliPath, ["--version"], 5000);
      status.version = stdout.trim();
    } catch {
      // CLI found but failed to run
      return status;
    }

    // Check authentication by running a minimal prompt.
    // Uses spawn (shell:false) so the same environment is in play as actual
    // invocations — avoiding misleading "authenticated = true" results when
    // execAsync (shell-based) would succeed but spawn would fail.
    try {
      await this.spawnGetOutput(
        cliPath,
        ["-p", "hi", "--model", "claude-sonnet-4", "--no-auto-update"],
        30000
      );
      status.authenticated = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("auth") ||
        errorMsg.includes("login") ||
        errorMsg.includes("unauthorized")
      ) {
        status.authError = "Not logged in";
      } else {
        // Other error, but CLI works so auth is probably ok
        // Could be rate limit, model error, etc.
        status.authenticated = true;
      }
    }

    return status;
  }

  /**
   * Run a CLI command via spawn (shell:false) and return stdout/stderr.
   * Uses the resolved shell environment so the process inherits the correct
   * PATH and credentials regardless of how Obsidian was launched.
   */
  private spawnGetOutput(
    execPath: string,
    args: string[],
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(execPath, args, {
        shell: false,
        timeout: timeoutMs,
        windowsHide: true,
        env: getShellEnv(),
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const errMsg =
            code !== null
              ? stderr || stdout || `exit code ${String(code)}`
              : "Process terminated by signal";
          reject(new Error(errMsg));
        }
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Find the copilot CLI binary path
   * GUI apps (like Obsidian) don't inherit shell PATH, so we check known locations
   */
  private findCopilotCliPath(): string | null {
    const platform = process.platform;
    const knownPaths = COPILOT_CLI_PATHS[platform] || [];

    // First check known installation paths (most reliable for GUI apps)
    for (const p of knownPaths) {
      if (p && existsSync(p)) {
        return p;
      }
    }

    // Fallback: try to find in PATH (works if launched from terminal)
    try {
      const whichCmd = platform === "win32" ? "where copilot" : "which copilot";
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
   * Invoke the copilot CLI (non-streaming)
   *
   * SECURITY: Uses spawn with shell:false to prevent injection
   */
  private async invokeCopilotCli(prompt: string, model: string, _streaming: boolean): Promise<string> {
    // Prevent concurrent invocations
    if (this.activeProcess) {
      throw new Error("A request is already in progress. Please wait.");
    }

    // Get the CLI path from cache (should already be set from validation)
    const cliPath = this.cliStatusCache?.cliPath || this.findCopilotCliPath();
    if (!cliPath) {
      throw new Error(
        "Copilot CLI not found. Install with: brew install copilot-cli"
      );
    }

    return new Promise((resolve, reject) => {
      // Arguments for non-interactive mode
      const args = this.buildCliArgs(prompt, model, false);

      // CRITICAL: shell: false prevents shell interpretation
      const child = spawn(cliPath, args, {
        shell: false, // <-- CRITICAL SECURITY SETTING
        timeout: 120000, // 2 minute timeout
        windowsHide: true, // Prevent window popup on Windows
        env: getShellEnv(),
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
          // Parse out just the response, removing usage stats
          const response = this.parseCliOutput(stdout);
          resolve(response);
        } else {
          // Log the actual error for debugging
          console.error("[PA] copilot CLI error:", { code, stderr, stdout });
          reject(new Error(this.sanitiseErrorMessage(stderr || stdout, code)));
        }
      });

      child.on("error", (err) => {
        this.activeProcess = null;
        console.error("[PA] copilot CLI spawn error:", err);
        reject(new Error(this.sanitiseErrorMessage(err.message, null)));
      });
    });
  }

  /**
   * Invoke the copilot CLI with streaming output
   *
   * Streams tokens to the callback as they arrive from stdout.
   * SECURITY: Uses spawn with shell:false to prevent injection
   */
  private async invokeCopilotCliStreaming(
    prompt: string,
    model: string,
    onChunk: StreamCallback
  ): Promise<string> {
    // Prevent concurrent invocations
    if (this.activeProcess) {
      throw new Error("A request is already in progress. Please wait.");
    }

    // Get the CLI path from cache (should already be set from validation)
    const cliPath = this.cliStatusCache?.cliPath || this.findCopilotCliPath();
    if (!cliPath) {
      throw new Error(
        "Copilot CLI not found. Install with: brew install copilot-cli"
      );
    }

    return new Promise((resolve, reject) => {
      // Arguments for streaming mode
      const args = this.buildCliArgs(prompt, model, true);

      // CRITICAL: shell: false prevents shell interpretation
      const child = spawn(cliPath, args, {
        shell: false,
        timeout: 120000, // 2 minute timeout
        windowsHide: true,
        env: getShellEnv(),
      });

      this.activeProcess = child;

      let fullContent = "";
      let stderr = "";
      let isInUsageSection = false;

      child.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        
        // Check if we've hit the usage stats section
        if (
          chunk.includes("Total usage est:") ||
          chunk.includes("API time spent:") ||
          chunk.includes("Total session time:")
        ) {
          isInUsageSection = true;
        }

        // Only stream content before usage section
        if (!isInUsageSection) {
          fullContent += chunk;
          onChunk({ content: chunk, done: false });
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0) {
          // Signal completion
          onChunk({ content: "", done: true });
          // Return trimmed full content (remove trailing whitespace before usage section)
          resolve(fullContent.trim());
        } else {
          console.error("[PA] copilot CLI error:", { code, stderr, fullContent });
          reject(new Error(this.sanitiseErrorMessage(stderr || fullContent, code)));
        }
      });

      child.on("error", (err) => {
        this.activeProcess = null;
        console.error("[PA] copilot CLI spawn error:", err);
        reject(new Error(this.sanitiseErrorMessage(err.message, null)));
      });
    });
  }

  /**
   * Build CLI arguments for non-interactive invocations.
   */
  protected buildCliArgs(prompt: string, model: string, streaming: boolean): string[] {
    const args = [
      "-p",
      prompt,
      "--model",
      model,
      "--no-auto-update", // Don't try to update during invocation
      ...this.buildPermissionArgs(),
    ];

    if (!streaming) {
      args.push("--stream", "off"); // Disable streaming for simpler output parsing
    }

    return args;
  }

  /**
   * Build scoped permission args for non-interactive tool use.
   */
  private buildPermissionArgs(): string[] {
    if (!this.vaultBasePath) {
      return [];
    }

    return [
      "--add-dir",
      this.vaultBasePath,
      "--allow-tool=edit",
      "--allow-tool=bash",
    ];
  }

  /**
   * Parse CLI output to extract just the response content
   * The CLI adds usage stats at the end which we want to strip
   */
  private parseCliOutput(output: string): string {
    // The CLI output format in non-interactive mode:
    // <response content>
    //
    // Total usage est:        X Premium request
    // API time spent:         Xs
    // ...

    const lines = output.split("\n");
    const responseLines: string[] = [];
    let foundUsageSection = false;

    for (const line of lines) {
      if (
        line.startsWith("Total usage est:") ||
        line.startsWith("API time spent:") ||
        line.startsWith("Total session time:") ||
        line.startsWith("Total code changes:") ||
        line.startsWith("Breakdown by AI model:")
      ) {
        foundUsageSection = true;
        break;
      }
      responseLines.push(line);
    }

    // If we found usage section, trim trailing empty lines from response
    if (foundUsageSection) {
      while (
        responseLines.length > 0 &&
        responseLines[responseLines.length - 1].trim() === ""
      ) {
        responseLines.pop();
      }
    }

    return responseLines.join("\n").trim();
  }

  /**
   * Sanitise error messages to avoid leaking sensitive info
   */
  protected sanitiseErrorMessage(rawError: string, exitCode: number | null): string {
    const patterns: Array<[RegExp, string]> = [
      [
        /command not found|not recognized/i,
        "Copilot CLI not found. Install with: brew install copilot-cli",
      ],
      [
        /401|unauthorized|not logged in|auth.*failed/i,
        "Not authenticated with Copilot. Run: copilot",
      ],
      [
        /permission denied.*could not request permission from user|could not request permission from user/i,
        "Permission denied. Copilot CLI may not have write access to your vault directory. " +
          "Ensure the vault path is allowed for Copilot CLI tool use.",
      ],
      [
        /403|forbidden|access denied|permission/i,
        "Access denied. Ensure you have a valid Copilot licence.",
      ],
      [
        /429|rate.limit|too many requests/i,
        "Rate limit exceeded. Please wait a moment and try again.",
      ],
      [
        /timeout|timed out|deadline exceeded/i,
        "Request timed out. Try a shorter prompt or simpler question.",
      ],
      [
        /model.*not found|invalid model|unknown model/i,
        "Selected model is not available. Go to Settings → Model Settings and choose a valid model.",
      ],
      [/network|connection|ENOTFOUND|ECONNREFUSED/i, "Network error. Check your internet connection."],
      [/ENOENT|not found|command not found/i, "Copilot CLI not found. Reinstall GitHub Copilot CLI."],
      // macOS GUI environment: EPERM / EACCES when the process can't access
      // credentials because the GUI app environment is stripped.  On macOS,
      // suggest launching Obsidian from a terminal as a workaround.
      [
        /EPERM|Operation not permitted|permission denied|EACCES/i,
        process.platform === "darwin"
          ? "Operation not permitted. The Copilot CLI could not access its credentials. " +
            "Try launching Obsidian from a terminal: open -a Obsidian"
          : "Permission denied. Copilot CLI may not have write access to your vault directory. " +
            "Ensure the vault path is allowed for Copilot CLI tool use.",
      ],
      [/spawn|fork|child_process/i, "Failed to start Copilot CLI process."],
      [/signal|SIGTERM|SIGKILL|killed/i, "Request was cancelled or terminated."],
      [/JSON|parse|syntax/i, "Received invalid response from Copilot CLI."],
    ];

    for (const [pattern, message] of patterns) {
      if (pattern.test(rawError)) {
        return message;
      }
    }

    // For unrecognized errors, include a sanitized snippet of the actual error
    // This helps users (and support) understand what went wrong
    const sanitized = this.sanitizeForDisplay(rawError);
    
    if (exitCode !== null && exitCode !== 0) {
      return `Copilot CLI failed (exit ${exitCode}): ${sanitized}`;
    }
    return `Copilot CLI error: ${sanitized}`;
  }

  /**
   * Sanitize error text for display to user
   * Removes potentially sensitive info and truncates
   */
  private sanitizeForDisplay(errorText: string): string {
    // Remove potential paths containing usernames
    let sanitized = errorText
      .replace(/\/Users\/[^/\s]+/g, "~")
      .replace(/\/home\/[^/\s]+/g, "~")
      .replace(/C:\\Users\\[^\\]+/gi, "~")
      // Remove tokens/keys that might be in errors
      .replace(/token[=:]\s*\S+/gi, "token=***")
      .replace(/key[=:]\s*\S+/gi, "key=***")
      .replace(/bearer\s+\S+/gi, "bearer ***")
      // Clean up excessive whitespace
      .replace(/\s+/g, " ")
      .trim();
    
    // Truncate to reasonable length
    if (sanitized.length > 150) {
      sanitized = sanitized.slice(0, 147) + "...";
    }
    
    // If empty after sanitization, provide generic message
    if (!sanitized) {
      return "Unknown error occurred";
    }
    
    return sanitized;
  }

  /**
   * Wrap errors consistently
   */
  private wrapError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }
}
