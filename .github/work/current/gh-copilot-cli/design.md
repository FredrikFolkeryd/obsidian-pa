# Technical Design: GhCopilotCliProvider

**Feature**: Add support for `gh copilot` CLI as an alternative AI provider  
**Author**: Architect Agent  
**Date**: 2026-02-01  
**Status**: Draft

---

## 1. Overview

### 1.1 Problem Statement

Users with GitHub Copilot Enterprise/Business licences have access to premium AI models (e.g., Claude Opus 4.5, o1) through the `gh copilot` CLI extension. Currently, obsidian-pa only supports the GitHub Models API, which has a more limited model selection. By integrating with the `gh copilot` CLI, we can provide seamless access to these premium models without requiring additional API tokens.

### 1.2 Proposed Solution

Create a new provider (`GhCopilotCliProvider`) that:
- Invokes the `gh copilot` CLI via child process execution
- Uses the existing GitHub CLI OAuth authentication (no separate token required)
- Maps chat messages to CLI invocations
- Returns CLI output as chat responses

### 1.3 Key Benefits

- **Zero additional authentication**: Uses existing `gh auth` credentials
- **Access to premium models**: Claude Opus 4.5, o1, and future models
- **Enterprise compliance**: Uses approved enterprise tooling
- **No API quotas/costs**: Uses Copilot licence entitlements

---

## 2. Architecture Overview

### 2.1 Current Provider System

```
┌─────────────────────────────────────────────────────────────────┐
│                       ProviderManager                            │
│  ┌─────────────────┬─────────────────┬───────────────────────┐  │
│  │ GitHubModels    │ CopilotEnterprise│ Anthropic            │  │
│  │ Provider        │ Provider (stub)  │ Provider             │  │
│  └────────┬────────┴────────┬─────────┴──────────┬───────────┘  │
│           │                 │                    │               │
│           ▼                 ▼                    ▼               │
│      HTTP API          (not impl)           HTTP API            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       ProviderManager                            │
│  ┌─────────────────┬─────────────────┬───────────────────────┐  │
│  │ GitHubModels    │ GhCopilotCli    │ Anthropic            │  │
│  │ Provider        │ Provider (NEW)  │ Provider             │  │
│  └────────┬────────┴────────┬────────┴───────────┬───────────┘  │
│           │                 │                    │               │
│           ▼                 ▼                    ▼               │
│      HTTP API       Child Process           HTTP API            │
│                    (gh copilot CLI)                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Provider Type Addition

Add a new provider type to the existing union in [src/api/types.ts](src/api/types.ts):

```typescript
export type ProviderType =
  | "github-models"
  | "github-copilot-enterprise"
  | "gh-copilot-cli"  // NEW
  | "anthropic"
  | "openai"
  | "azure-openai"
  | "aws-bedrock";
```

---

## 3. Provider Implementation

### 3.1 Class Structure

```typescript
// src/api/providers/GhCopilotCliProvider.ts

import { BaseProvider, PROVIDER_CONFIGS } from "../BaseProvider";
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  ProviderCapabilities,
  Result,
} from "../types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * GitHub Copilot CLI Provider
 *
 * Invokes the gh-copilot CLI extension for chat completions.
 * Requires: gh CLI with gh-copilot extension installed and authenticated.
 */
export class GhCopilotCliProvider extends BaseProvider {
  private cliAvailable: boolean | null = null;
  private ghPath: string | null = null;
  
  public constructor() {
    super(PROVIDER_CONFIGS["gh-copilot-cli"]);
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,      // CLI returns full response
      supportsSystemPrompt: true,    // Prepend to prompt
      supportsFunctionCalling: false, // Not supported via CLI
      supportsVision: false,          // Not supported via CLI
    };
  }

  // ... implementation details below
}
```

### 3.2 Provider Configuration

Add to `PROVIDER_CONFIGS` in [src/api/BaseProvider.ts](src/api/BaseProvider.ts):

```typescript
"gh-copilot-cli": {
  type: "gh-copilot-cli",
  name: "GitHub Copilot CLI",
  description: "Premium models via gh copilot CLI (requires Copilot licence)",
  enabled: true,
  requiresToken: false,  // Uses gh auth
  tokenInstructions: 
    "No token needed. Ensure you are logged in with 'gh auth login' " +
    "and have the copilot extension: 'gh extension install github/gh-copilot'",
},
```

---

## 4. CLI Detection

### 4.1 Detection Strategy

The provider needs to verify three things:
1. `gh` CLI is installed and in PATH
2. `gh-copilot` extension is installed
3. User is authenticated with GitHub

### 4.2 Implementation

```typescript
interface CliStatus {
  ghInstalled: boolean;
  ghPath: string | null;
  copilotExtensionInstalled: boolean;
  authenticated: boolean;
  authError?: string;
}

/**
 * Check if gh CLI and copilot extension are available
 */
private async checkCliStatus(): Promise<CliStatus> {
  const status: CliStatus = {
    ghInstalled: false,
    ghPath: null,
    copilotExtensionInstalled: false,
    authenticated: false,
  };

  try {
    // Check gh CLI exists
    const { stdout: whichOutput } = await execAsync(
      process.platform === "win32" ? "where gh" : "which gh"
    );
    status.ghPath = whichOutput.trim().split("\n")[0];
    status.ghInstalled = true;
  } catch {
    return status; // gh not installed
  }

  try {
    // Check copilot extension
    const { stdout: extOutput } = await execAsync("gh extension list");
    status.copilotExtensionInstalled = extOutput.includes("github/gh-copilot");
  } catch {
    return status;
  }

  try {
    // Check authentication
    const { stdout: authOutput } = await execAsync("gh auth status");
    status.authenticated = authOutput.includes("Logged in");
  } catch (error) {
    status.authError = error instanceof Error ? error.message : "Auth check failed";
  }

  return status;
}
```

### 4.3 Caching

Cache the CLI status for the session to avoid repeated shell invocations:

```typescript
private cliStatusCache: CliStatus | null = null;
private cliStatusCacheTime: number = 0;
private readonly CLI_CACHE_TTL = 60000; // 1 minute

private async getCachedCliStatus(): Promise<CliStatus> {
  const now = Date.now();
  if (this.cliStatusCache && now - this.cliStatusCacheTime < this.CLI_CACHE_TTL) {
    return this.cliStatusCache;
  }
  this.cliStatusCache = await this.checkCliStatus();
  this.cliStatusCacheTime = now;
  return this.cliStatusCache;
}
```

---

## 5. Authentication

### 5.1 Authentication Model

Unlike other providers that use explicit tokens, this provider leverages the existing `gh auth` session:

```typescript
/**
 * Override: This provider doesn't use tokens
 */
public isAuthenticated(): boolean {
  // Synchronous check - use cached status
  return this.cliStatusCache?.authenticated ?? false;
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
      error: "gh-copilot extension not installed. Run: gh extension install github/gh-copilot",
    };
  }
  
  if (!status.authenticated) {
    return {
      success: false,
      error: `Not authenticated with GitHub CLI. Run: gh auth login\n${status.authError || ""}`,
    };
  }
  
  return { success: true, data: true };
}
```

### 5.2 Token Methods (No-op)

```typescript
/**
 * No token needed - uses gh auth
 */
public setToken(_token: string): void {
  // No-op: this provider uses gh auth, not tokens
  console.info("[PA] GhCopilotCliProvider: setToken ignored - uses gh auth");
}

public clearToken(): void {
  // No-op
}
```

---

## 6. Chat Interface

### 6.1 Message Mapping

The `gh copilot` CLI takes a single prompt string. We need to flatten chat history:

```typescript
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
```

### 6.2 Chat Implementation

```typescript
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
 * Invoke the gh copilot CLI
 */
private async invokeCopilotCli(prompt: string, model: string): Promise<string> {
  // Escape the prompt for shell
  const escapedPrompt = this.escapeShellArg(prompt);
  
  const command = `gh copilot -p ${escapedPrompt} --model ${model}`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minute timeout for long responses
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });
    
    if (stderr && stderr.length > 0) {
      console.warn("[PA] gh copilot stderr:", stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    if (error instanceof Error && "killed" in error && error.killed) {
      throw new Error("Request timed out after 2 minutes");
    }
    throw error;
  }
}

/**
 * Escape string for shell argument
 */
private escapeShellArg(arg: string): string {
  // Use double quotes and escape internal quotes and backslashes
  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
```

### 6.3 Obsidian Compatibility

Since Obsidian runs in Electron, we need to use Node.js `child_process`. Ensure proper import:

```typescript
// At the top of the file
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
```

**Note**: On Windows, the command syntax may differ. Consider using `spawn` with shell option for better cross-platform compatibility:

```typescript
import { spawn } from "child_process";

private async invokeCopilotCli(prompt: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["copilot", "-p", prompt, "--model", model];
    const child = spawn("gh", args, {
      shell: true,
      timeout: 120000,
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Exit code: ${code}`));
      }
    });
    
    child.on("error", reject);
  });
}
```

---

## 7. Model Discovery

### 7.1 Approach

The `gh copilot` CLI doesn't expose a model listing API. We have two options:

1. **Hardcode known models** (recommended for v1)
2. **Try to parse help output** (fragile)

### 7.2 Hardcoded Model List

```typescript
/**
 * Known models available via gh copilot CLI
 * Updated periodically based on GitHub announcements
 */
private static readonly KNOWN_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "gh-copilot-cli",
    description: "Most capable Claude model - best for complex tasks",
  },
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "gh-copilot-cli",
    description: "Balanced performance and speed",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "gh-copilot-cli",
    description: "OpenAI's latest multimodal model",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "gh-copilot-cli",
    description: "OpenAI GPT-4 Turbo",
  },
  {
    id: "o1",
    name: "o1",
    provider: "gh-copilot-cli",
    description: "OpenAI reasoning model",
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "gh-copilot-cli",
    description: "Efficient reasoning model",
  },
];

public async getModels(): Promise<ModelInfo[]> {
  // Could potentially filter based on what's actually available
  // For now, return all known models
  return GhCopilotCliProvider.KNOWN_MODELS;
}

public getDefaultModel(): string {
  return "claude-opus-4.5";
}
```

### 7.3 Future Enhancement: Model Validation

Optionally validate that a model is actually available:

```typescript
private async isModelAvailable(model: string): Promise<boolean> {
  try {
    // Try a minimal prompt
    await execAsync(`gh copilot -p "test" --model ${model}`, {
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}
```

---

## 8. Settings UI Changes

### 8.1 Provider Selection

The existing settings UI already supports provider selection. The new provider will appear automatically once registered.

### 8.2 Diagnostic Button

Add a "Check CLI Status" button for troubleshooting:

```typescript
// In PASettingTab.renderAuthSection()

if (this.plugin.providerManager.getActiveProviderType() === "gh-copilot-cli") {
  new Setting(containerEl)
    .setName("CLI Status")
    .setDesc("Verify gh copilot CLI is properly configured")
    .addButton((button) =>
      button
        .setButtonText("Check Status")
        .onClick(async () => {
          const result = await this.plugin.providerManager.validateProviderToken("gh-copilot-cli");
          if (result.success) {
            new Notice("✓ gh copilot CLI is ready to use");
          } else {
            new Notice(`✗ ${result.error}`, 10000);
          }
        })
    );
}
```

### 8.3 Installation Instructions

Display installation instructions when provider is selected but not available:

```typescript
private renderGhCopilotInstructions(containerEl: HTMLElement): void {
  const infoBox = containerEl.createDiv({ cls: "pa-cli-info" });
  
  infoBox.createEl("h4", { text: "Setup Instructions" });
  
  const steps = infoBox.createEl("ol");
  steps.createEl("li", { text: "Install GitHub CLI: https://cli.github.com/" });
  steps.createEl("li", { text: "Login: gh auth login" });
  steps.createEl("li", { text: "Install Copilot extension: gh extension install github/gh-copilot" });
  steps.createEl("li", { text: "Verify: gh copilot --help" });
  
  infoBox.createEl("p", {
    text: "Note: Requires a GitHub Copilot Business or Enterprise licence.",
    cls: "pa-cli-note",
  });
}
```

---

## 9. Error Handling

### 9.1 Error Categories

| Error Type | Cause | User Message |
|------------|-------|--------------|
| CLI_NOT_FOUND | gh not in PATH | "GitHub CLI not found. Install from cli.github.com" |
| EXTENSION_MISSING | gh-copilot not installed | "Install copilot: gh extension install github/gh-copilot" |
| NOT_AUTHENTICATED | gh auth not logged in | "Not logged in. Run: gh auth login" |
| RATE_LIMITED | Too many requests | "Rate limit reached. Please wait and try again." |
| MODEL_NOT_FOUND | Invalid model ID | "Model 'X' not available. Check your Copilot licence." |
| TIMEOUT | Response took too long | "Request timed out. Try a shorter prompt." |
| PERMISSION_DENIED | No Copilot licence | "Copilot access denied. Contact your admin." |

### 9.2 Error Wrapping

```typescript
private wrapError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }
  
  const message = error.message.toLowerCase();
  
  if (message.includes("command not found") || message.includes("not recognized")) {
    return new Error(
      "GitHub CLI not found. Install from https://cli.github.com/"
    );
  }
  
  if (message.includes("gh copilot") && message.includes("not")) {
    return new Error(
      "gh-copilot extension not installed. Run: gh extension install github/gh-copilot"
    );
  }
  
  if (message.includes("401") || message.includes("unauthorized")) {
    return new Error(
      "Not authenticated with GitHub. Run: gh auth login"
    );
  }
  
  if (message.includes("403") || message.includes("forbidden")) {
    return new Error(
      "Access denied. Ensure you have a valid Copilot licence."
    );
  }
  
  if (message.includes("429") || message.includes("rate")) {
    return new Error(
      "Rate limit exceeded. Please wait a moment and try again."
    );
  }
  
  if (message.includes("timeout") || message.includes("timed out")) {
    return new Error(
      "Request timed out. Try a shorter prompt or simpler question."
    );
  }
  
  // Pass through other errors
  return error;
}
```

---

## 10. Limitations

### 10.1 Functional Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **No streaming** | User waits for full response | Display loading indicator |
| **No vision** | Cannot process images | Use GitHub Models for vision |
| **No function calling** | No tool use | Use GitHub Models for agents |
| **No usage stats** | Cannot show token count | Display "N/A" in UI |
| **Single turn optimised** | Long conversations may degrade | Recommend keeping history short |

### 10.2 Platform Limitations

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ Supported | Primary development target |
| Linux | ✅ Supported | Standard PATH lookup |
| Windows | ⚠️ Partial | May need PATH adjustments |
| Mobile | ❌ Not supported | No CLI on iOS/Android |

### 10.3 Performance Considerations

- **Latency**: CLI invocation adds ~100-500ms overhead
- **Process spawning**: Each request spawns a new process
- **Memory**: Large responses may hit buffer limits
- **Concurrent requests**: Avoid parallel CLI invocations

### 10.4 Security Considerations

- **Prompt injection**: Escape all user input properly
- **Shell execution**: Use `spawn` over `exec` where possible
- **Credential exposure**: CLI handles auth, no tokens stored

---

## 11. Implementation Plan

### Phase 1: Core Provider (MVP)

1. Add `gh-copilot-cli` to `ProviderType` union
2. Add provider config to `PROVIDER_CONFIGS`
3. Create `GhCopilotCliProvider` class with:
   - CLI detection
   - Basic chat functionality
   - Hardcoded model list
4. Register provider in `ProviderManager`
5. Add export to `providers/index.ts`

### Phase 2: Settings & UX

6. Add CLI status check button in settings
7. Add installation instructions
8. Add appropriate error messages

### Phase 3: Testing & Polish

9. Write unit tests with mocked CLI
10. Manual testing on macOS/Windows
11. Documentation updates

### Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1 | 4-6 hours |
| Phase 2 | 2-3 hours |
| Phase 3 | 3-4 hours |
| **Total** | **9-13 hours** |

---

## 12. Testing Strategy

### 12.1 Unit Tests

```typescript
// GhCopilotCliProvider.test.ts

import { GhCopilotCliProvider } from "./GhCopilotCliProvider";

// Mock child_process
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

describe("GhCopilotCliProvider", () => {
  describe("checkCliStatus", () => {
    it("returns ghInstalled=false when gh not in PATH", async () => { ... });
    it("returns copilotExtensionInstalled=false when extension missing", async () => { ... });
    it("returns authenticated=false when not logged in", async () => { ... });
    it("returns all true when properly configured", async () => { ... });
  });

  describe("chat", () => {
    it("formats messages correctly", async () => { ... });
    it("handles model selection", async () => { ... });
    it("wraps CLI errors properly", async () => { ... });
  });
});
```

### 12.2 Integration Tests

- Manual test with real CLI on development machine
- Verify each model works
- Test error scenarios (logout, uninstall extension, etc.)

---

## 13. File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/api/types.ts` | Modify | Add `gh-copilot-cli` to `ProviderType` |
| `src/api/BaseProvider.ts` | Modify | Add provider config to `PROVIDER_CONFIGS` |
| `src/api/providers/GhCopilotCliProvider.ts` | **New** | Full provider implementation |
| `src/api/providers/index.ts` | Modify | Export new provider |
| `src/api/ProviderManager.ts` | Modify | Instantiate new provider |
| `src/settings.ts` | Modify | Add CLI status UI elements |

---

## 14. Open Questions

1. **Model updates**: How do we keep the model list current?
   - Option A: Hardcode and update with plugin releases
   - Option B: Fetch from GitHub API (if available)
   - **Recommendation**: Option A for v1

2. **Windows support**: Need to test PATH lookup and shell escaping
   - May need platform-specific adjustments

3. **Conversation length**: How does the CLI handle long prompts?
   - May need to implement context windowing

4. **Rate limits**: What are the Copilot CLI rate limits?
   - Need to investigate and implement appropriate handling

---

## 15. Appendix: CLI Command Reference

### Basic Usage

```bash
# Check version
gh copilot --version

# Simple prompt
gh copilot -p "Explain quantum computing"

# With model selection
gh copilot -p "Hello" --model claude-opus-4.5

# Check auth status
gh auth status
```

### Installation

```bash
# Install gh CLI (macOS)
brew install gh

# Login
gh auth login

# Install copilot extension
gh extension install github/gh-copilot

# Verify
gh copilot --help
```
