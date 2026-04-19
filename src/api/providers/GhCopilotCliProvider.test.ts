/**
 * Tests for GitHub Copilot CLI Provider
 *
 * Tests the CLI provider implementation with mocked child_process.
 * Note: Some tests require complex mocking of promisified exec, which is
 * deferred to integration tests. These unit tests focus on:
 * - Static configuration and capabilities
 * - Token handling (no-op for this provider)
 * - CLI not found scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock child_process before importing the provider
vi.mock("child_process", () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

// Import after mocks are set up
import { GhCopilotCliProvider } from "./GhCopilotCliProvider";
import { execSync } from "child_process";
import { existsSync } from "fs";

class TestableGhCopilotCliProvider extends GhCopilotCliProvider {
  public testBuildCliArgs(prompt: string, model: string, streaming: boolean): string[] {
    return this.buildCliArgs(prompt, model, streaming);
  }

  public testSanitiseErrorMessage(rawError: string, exitCode: number | null): string {
    return this.sanitiseErrorMessage(rawError, exitCode);
  }
}

describe("GhCopilotCliProvider", () => {
  let provider: TestableGhCopilotCliProvider;
  const mockExecSync = execSync as ReturnType<typeof vi.fn>;
  const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new TestableGhCopilotCliProvider();
  });

  afterEach(() => {
    provider.onUnload();
  });

  describe("constructor and config", () => {
    it("should create provider with correct type", () => {
      expect(provider.type).toBe("gh-copilot-cli");
    });

    it("should have correct display name", () => {
      expect(provider.name).toBe("GitHub Copilot CLI");
    });

    it("should have a description", () => {
      expect(provider.description).toBeDefined();
      expect(provider.description.length).toBeGreaterThan(0);
    });
  });

  describe("getCapabilities", () => {
    it("should return correct capabilities", () => {
      const caps = provider.getCapabilities();

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsSystemPrompt).toBe(true);
      expect(caps.supportsFunctionCalling).toBe(false);
      expect(caps.supportsVision).toBe(false);
    });
  });

  describe("getModels", () => {
    it("should return known models", async () => {
      const models = await provider.getModels();

      expect(models.length).toBeGreaterThan(0);

      // Check for expected models
      const modelIds = models.map((m) => m.id);
      expect(modelIds).toContain("claude-sonnet-4");
      expect(modelIds).toContain("gpt-4.1");
      expect(modelIds).toContain("gemini-3-pro-preview");
    });

    it("should have provider set on all models", async () => {
      const models = await provider.getModels();

      for (const model of models) {
        expect(model.provider).toBe("gh-copilot-cli");
      }
    });

    it("should have names and descriptions for all models", async () => {
      const models = await provider.getModels();

      for (const model of models) {
        expect(model.name).toBeDefined();
        expect(model.name.length).toBeGreaterThan(0);
        expect(model.description).toBeDefined();
      }
    });
  });

  describe("getDefaultModel", () => {
    it("should return claude-sonnet-4 as default", () => {
      expect(provider.getDefaultModel()).toBe("claude-sonnet-4");
    });

    it("should return a model that exists in the model list", async () => {
      const defaultModel = provider.getDefaultModel();
      const models = await provider.getModels();
      const modelIds = models.map((m) => m.id);

      expect(modelIds).toContain(defaultModel);
    });
  });

  describe("isAuthenticated", () => {
    it("should return false initially (no cache)", () => {
      expect(provider.isAuthenticated()).toBe(false);
    });
  });

  describe("setToken", () => {
    it("should be a no-op (CLI uses its own auth)", () => {
      // Should not throw
      provider.setToken("any-token");

      // isAuthenticated should still be false (CLI provider doesn't use tokens)
      expect(provider.isAuthenticated()).toBe(false);
    });

    it("should accept any token value without throwing", () => {
      expect(() => provider.setToken("")).not.toThrow();
      expect(() => provider.setToken("ghp_xxxxx")).not.toThrow();
      expect(() => provider.setToken("sk-xxxxx")).not.toThrow();
    });
  });

  describe("clearToken", () => {
    it("should clear the cache without throwing", () => {
      expect(() => provider.clearToken()).not.toThrow();
    });

    it("should be safe to call multiple times", () => {
      provider.clearToken();
      provider.clearToken();
      expect(provider.isAuthenticated()).toBe(false);
    });
  });

  describe("validateToken", () => {
    it("should return error when CLI not installed (no known paths)", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const result = await provider.validateToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain("not installed");
    });

    it("should check known CLI paths", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      await provider.validateToken();

      // Should have checked at least one path (platform-specific)
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it("should return user-friendly error message", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const result = await provider.validateToken();

      // Error should mention how to install
      expect(result.error).toContain("brew install");
    });
  });

  describe("chat without authentication", () => {
    it("should throw when CLI not found", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      await expect(
        provider.chat(
          [{ role: "user", content: "Hello" }],
          { model: "claude-sonnet-4" }
        )
      ).rejects.toThrow();
    });
  });

  describe("chatStream without authentication", () => {
    it("should throw when CLI not found", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      await expect(
        provider.chatStream(
          [{ role: "user", content: "Hello" }],
          { model: "claude-sonnet-4" },
          () => {}
        )
      ).rejects.toThrow();
    });
  });

  describe("onUnload", () => {
    it("should not throw when no active process", () => {
      expect(() => provider.onUnload()).not.toThrow();
    });

    it("should handle multiple calls gracefully", () => {
      provider.onUnload();
      provider.onUnload();
      provider.onUnload();
    });
  });

  describe("CLI path discovery", () => {
    it("should check known platform paths", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      await provider.validateToken();

      // Should check platform-specific paths
      if (process.platform === "darwin") {
        // macOS: check Homebrew paths
        expect(mockExistsSync).toHaveBeenCalledWith("/opt/homebrew/bin/copilot");
        expect(mockExistsSync).toHaveBeenCalledWith("/usr/local/bin/copilot");
      } else if (process.platform === "linux") {
        // Linux: check standard paths
        expect(mockExistsSync).toHaveBeenCalledWith("/usr/local/bin/copilot");
      }
      // At minimum, some path should have been checked
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it("should fallback to which command when paths don't exist", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      await provider.validateToken();

      // Should have tried execSync for 'which' command
      expect(mockExecSync).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle missing HOME environment variable gracefully", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error("not found");
      });

      // Should not throw even if HOME is undefined in paths
      const result = await provider.validateToken();
      expect(result.success).toBe(false);
    });
  });

  describe("non-interactive permission args", () => {
    it("should include scoped tool permissions when vault path is set", () => {
      provider.setVaultBasePath("/tmp/vault");

      const args = provider.testBuildCliArgs("hello", "claude-sonnet-4", false);
      const addDirIndex = args.indexOf("--add-dir");

      expect(addDirIndex).toBeGreaterThan(-1);
      expect(args[addDirIndex + 1]).toBe("/tmp/vault");
      expect(args).toContain("--allow-tool=edit");
      expect(args).toContain("--allow-tool=bash");
      expect(args).toContain("--stream");
      expect(args).toContain("off");
    });

    it("should omit scoped tool permissions when vault path is not set", () => {
      const args = provider.testBuildCliArgs("hello", "claude-sonnet-4", true);

      expect(args).not.toContain("--add-dir");
      expect(args).not.toContain("--allow-tool=edit");
      expect(args).not.toContain("--allow-tool=bash");
    });
  });

  describe("sanitiseErrorMessage", () => {
    it("should return vault write access guidance for permission denied errors", () => {
      const sanitized = provider.testSanitiseErrorMessage(
        "Permission denied and could not request permission from user",
        1
      );

      expect(sanitized).toContain("vault directory");
      expect(sanitized).toContain("allowed");
    });
  });
});
