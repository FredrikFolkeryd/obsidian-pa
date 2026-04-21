/**
 * E2E Integration Tests for Chat Flow
 *
 * Tests the complete chat flow from user input through to AI response,
 * including vault access, provider management, and response handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProviderManager } from "../api/ProviderManager";
import { SafeVaultAccess } from "../vault/SafeVaultAccess";
import type { PASettings } from "../settings";
import type { App, TFile, Vault } from "obsidian";
import { TFile as MockTFile, Vault as MockVault, TFolder } from "../__mocks__/obsidian";
import type { ChatMessage } from "../api/types";

// Mock fetch globally
const originalFetch = global.fetch;

describe("Chat Flow E2E", () => {
  let settings: PASettings;
  let mockApp: Partial<App>;
  let mockVault: MockVault;
  let providerManager: ProviderManager;
  let safeVault: SafeVaultAccess;

  // Helper to create mock files
  const createMockFile = (path: string, content: string): MockTFile => {
    const file = new MockTFile();
    file.path = path;
    file.basename = path.split("/").pop()?.replace(".md", "") ?? "";
    file.stat = { mtime: Date.now(), ctime: Date.now(), size: content.length };
    return file;
  };

  // Mock file contents
  const fileContents: Record<string, string> = {
    "notes/daily.md": "# Daily Note\n\nToday I worked on the PA plugin.",
    "notes/ideas.md": "# Ideas\n\n- Improve streaming\n- Add exports",
    "projects/obsidian-pa.md": "# Obsidian PA\n\nAn AI assistant plugin.",
    "private/secrets.md": "API_KEY=supersecret123",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup settings
    settings = {
      consentEnabled: true,
      consentMode: "opt-in",
      includedFolders: ["notes", "projects"],
      excludedFolders: [],
      chatOnlyMode: false,
      model: "gpt-4o",
      authMethod: "direct",
      provider: "github-models",
      usageDate: "",
      usageRequests: 0,
      conversationHistory: [],
      maxHistoryMessages: 50,
    };

    // Setup mock vault with files
    const files = Object.keys(fileContents).map((path) =>
      createMockFile(path, fileContents[path])
    );

    mockVault = new MockVault();
    mockVault.read = vi.fn().mockImplementation((file: TFile) => {
      return Promise.resolve(fileContents[file.path] ?? "");
    });
    mockVault.getAbstractFileByPath = vi.fn().mockImplementation((path: string) =>
      files.find((f) => f.path === path) ?? null
    );
    mockVault.getMarkdownFiles = vi.fn(() => files);
    mockVault.getRoot = vi.fn(() => ({ path: "/" }) as TFolder);

    mockApp = {
      vault: mockVault as unknown as Vault,
    };

    // Create instances
    providerManager = new ProviderManager();
    // Set the token on the provider
    providerManager.setProviderToken("github-models", "test-token-123");
    safeVault = new SafeVaultAccess(mockApp as App, settings);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe("Full Chat Flow", () => {
    it("should complete a full chat request with context from vault", async () => {
      // Mock API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "chat-123",
            model: "gpt-4o",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Based on your notes, you're working on the PA plugin today.",
                },
              },
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 20,
              total_tokens: 70,
            },
          }),
      });

      // Step 1: Read context from vault (respecting consent)
      const allowedFiles = safeVault.getAllowedMarkdownFiles();
      expect(allowedFiles.length).toBe(3); // notes/daily.md, notes/ideas.md, projects/obsidian-pa.md

      // Step 2: Read a specific file for context
      const dailyNoteResult = await safeVault.readFile("notes/daily.md");
      expect(dailyNoteResult).not.toBeNull();
      expect(dailyNoteResult?.content).toContain("Daily Note");
      expect(dailyNoteResult?.content).toContain("PA plugin");
      const dailyNote = dailyNoteResult?.content ?? "";

      // Verify we cannot read private files
      const privateFile = await safeVault.readFile("private/secrets.md");
      expect(privateFile).toBeNull();

      // Step 3: Get active provider
      const provider = providerManager.getActiveProvider();
      expect(provider).not.toBeNull();
      expect(providerManager.isAuthenticated()).toBe(true);

      // Step 4: Send chat request with context
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: `Context from vault:\n${dailyNote}\n\nWhat am I working on today?`,
        },
      ];

      const response = await providerManager.chat(messages, {
        model: "gpt-4o",
        systemPrompt: "You are a helpful assistant with access to the user's notes.",
      });

      // Step 5: Verify response
      expect(response.content).toContain("PA plugin");
      expect(response.model).toBe("gpt-4o");
      expect(response.usage).toBeDefined();
      expect(response.usage?.totalTokens).toBe(70);

      // Verify the request included proper auth
      expect(global.fetch).toHaveBeenCalledWith(
        "https://models.inference.ai.azure.com/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        })
      );
    });

    it("should handle chat with custom system prompt", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "chat-123",
            model: "gpt-4o",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "I am your assistant.",
                },
              },
            ],
            usage: {
              prompt_tokens: 30,
              completion_tokens: 10,
              total_tokens: 40,
            },
          }),
      });

      const messages: ChatMessage[] = [{ role: "user", content: "Who are you?" }];

      const response = await providerManager.chat(
        messages,
        {
          model: "gpt-4o",
          systemPrompt: "You are a helpful PA assistant",
        }
      );

      expect(response.content).toBe("I am your assistant.");
      expect(response.model).toBe("gpt-4o");

      // Verify system prompt was included in the request
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      const callArgs = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toBe("You are a helpful PA assistant");
    });

    it("should respect vault consent and not leak private data", async () => {
      // Set up a scenario where user asks about private data
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "I don't have access to private files.",
                },
              },
            ],
          }),
      });

      // Try to get all files - should not include private
      const accessibleFiles = safeVault.getAllowedMarkdownFiles();
      const privatePaths = accessibleFiles.filter((f) =>
        f.path.startsWith("private/")
      );
      expect(privatePaths).toHaveLength(0);

      // Verify private file read is blocked
      const privateContent = await safeVault.readFile("private/secrets.md");
      expect(privateContent).toBeNull();

      // Even if somehow the path is passed, it should not be readable
      const isAllowed = safeVault.isPathAllowed("private/secrets.md");
      expect(isAllowed).toBe(false);
    });

    it("should handle provider switching mid-session", () => {
      // Start with GitHub Models
      expect(providerManager.getActiveProviderType()).toBe("github-models");

      // Create new provider manager for switching test
      const updatedManager = new ProviderManager();
      updatedManager.setProviderToken("github-models", "test-token-123");
      updatedManager.setProviderToken("gh-copilot-cli", "cli-token");

      // Switch to GH Copilot CLI (another enabled provider)
      const switched = updatedManager.setActiveProvider("gh-copilot-cli");
      expect(switched).toBe(true);
      expect(updatedManager.getActiveProviderType()).toBe("gh-copilot-cli");

      // Switch back to GitHub Models
      const switchedBack = updatedManager.setActiveProvider("github-models");
      expect(switchedBack).toBe(true);
      expect(updatedManager.getActiveProviderType()).toBe("github-models");

      // Attempting to switch to disabled provider should fail gracefully
      const failedSwitch = updatedManager.setActiveProvider("github-copilot-enterprise");
      expect(failedSwitch).toBe(false); // Returns false since provider is disabled
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: () =>
          Promise.resolve({
            error: { message: "Rate limit exceeded. Please try again later." },
          }),
      });

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      await expect(
        providerManager.chat(messages, { model: "gpt-4o" })
      ).rejects.toThrow(/Rate limit/);
    });

    it("should handle network failures", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      await expect(
        providerManager.chat(messages, { model: "gpt-4o" })
      ).rejects.toThrow(/Network error/);
    });

    it("should handle authentication failures", async () => {
      // Create manager with no tokens
      const unauthManager = new ProviderManager();
      // Don't set any tokens - manager will be unauthenticated

      expect(unauthManager.isAuthenticated()).toBe(false);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      await expect(
        unauthManager.chat(messages, { model: "gpt-4o" })
      ).rejects.toThrow(/authenticate/);
    });

    it("should handle disabled consent", async () => {
      // Disable consent
      settings.consentEnabled = false;
      const restrictedVault = new SafeVaultAccess(mockApp as App, settings);

      // Should not be able to read any files
      const accessibleFiles = restrictedVault.getAllowedMarkdownFiles();
      expect(accessibleFiles).toHaveLength(0);

      // All reads should be blocked
      const content = await restrictedVault.readFile("notes/daily.md");
      expect(content).toBeNull();
    });
  });

  describe("Model Selection", () => {
    it("should use default model from settings", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "Response" } }],
          }),
      });

      const messages: ChatMessage[] = [{ role: "user", content: "Test" }];

      await providerManager.chat(messages, { model: settings.model });

      // Verify the model was used in the request
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.model).toBe("gpt-4o");
    });

    it("should allow model override per request", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "Response" } }],
          }),
      });

      const messages: ChatMessage[] = [{ role: "user", content: "Test" }];

      await providerManager.chat(messages, { model: "gpt-4o-mini" });

      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.model).toBe("gpt-4o-mini");
    });
  });

  describe("Context Building", () => {
    it("should build context from multiple allowed files", async () => {
      // Read all accessible files
      const accessibleFiles = safeVault.getAllowedMarkdownFiles();
      expect(accessibleFiles.length).toBeGreaterThan(0);

      const contextParts: string[] = [];
      for (const file of accessibleFiles) {
        const result = await safeVault.readFile(file.path);
        if (result) {
          contextParts.push(`# ${file.path}\n${result.content}`);
        }
      }

      const fullContext = contextParts.join("\n\n");
      expect(fullContext).toContain("Daily Note");
      expect(fullContext).toContain("Ideas");
      expect(fullContext).toContain("Obsidian PA");
      expect(fullContext).not.toContain("supersecret123");
    });

    it("should respect opt-out mode exclusions", () => {
      // Switch to opt-out mode
      settings.consentMode = "opt-out";
      settings.excludedFolders = ["private"];
      settings.includedFolders = []; // Not used in opt-out

      const optOutVault = new SafeVaultAccess(mockApp as App, settings);

      // Should allow notes and projects
      expect(optOutVault.isPathAllowed("notes/daily.md")).toBe(true);
      expect(optOutVault.isPathAllowed("projects/obsidian-pa.md")).toBe(true);

      // Should exclude private folder
      expect(optOutVault.isPathAllowed("private/secrets.md")).toBe(false);
    });
  });
});
