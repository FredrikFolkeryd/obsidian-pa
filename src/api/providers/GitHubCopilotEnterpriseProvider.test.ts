/**
 * Tests for GitHub Copilot Enterprise Provider
 *
 * Tests the stub implementation for the future Copilot Enterprise provider.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GitHubCopilotEnterpriseProvider } from "./GitHubCopilotEnterpriseProvider";

describe("GitHubCopilotEnterpriseProvider", () => {
  let provider: GitHubCopilotEnterpriseProvider;

  beforeEach(() => {
    provider = new GitHubCopilotEnterpriseProvider();
  });

  describe("constructor and config", () => {
    it("should create provider with correct type", () => {
      expect(provider.type).toBe("github-copilot-enterprise");
    });

    it("should have correct display name", () => {
      expect(provider.name).toBe("GitHub Copilot Enterprise API");
    });

    it("should be disabled by default", () => {
      expect(provider.enabled).toBe(false);
    });
  });

  describe("getCapabilities", () => {
    it("should return expected capabilities", () => {
      const caps = provider.getCapabilities();

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsSystemPrompt).toBe(true);
      expect(caps.supportsFunctionCalling).toBe(true);
      expect(caps.supportsVision).toBe(true);
    });
  });

  describe("validateToken", () => {
    it("should always return error (not yet implemented)", async () => {
      const result = await provider.validateToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet available");
    });

    it("should mention checking with organization admin", async () => {
      const result = await provider.validateToken();

      expect(result.error).toContain("organization admin");
    });
  });

  describe("getModels", () => {
    it("should return placeholder models", async () => {
      const models = await provider.getModels();

      expect(models.length).toBeGreaterThan(0);

      const modelIds = models.map((m) => m.id);
      expect(modelIds).toContain("claude-opus-4.5");
      expect(modelIds).toContain("claude-sonnet-4");
      expect(modelIds).toContain("gpt-4o");
      expect(modelIds).toContain("o1");
    });

    it("should have provider set on all models", async () => {
      const models = await provider.getModels();

      for (const model of models) {
        expect(model.provider).toBe("github-copilot-enterprise");
      }
    });
  });

  describe("getDefaultModel", () => {
    it("should return claude-opus-4.5 as default", () => {
      expect(provider.getDefaultModel()).toBe("claude-opus-4.5");
    });
  });

  describe("chat", () => {
    it("should reject with not implemented error", async () => {
      await expect(
        provider.chat(
          [{ role: "user", content: "Hello" }],
          { model: "claude-opus-4.5" }
        )
      ).rejects.toThrow("not yet implemented");
    });

    it("should suggest using GitHub Models as alternative", async () => {
      await expect(
        provider.chat(
          [{ role: "user", content: "Hello" }],
          { model: "claude-opus-4.5" }
        )
      ).rejects.toThrow("GitHub Models");
    });
  });

  describe("authentication", () => {
    it("should not be authenticated by default", () => {
      expect(provider.isAuthenticated()).toBe(false);
    });

    it("should accept token setting without error", () => {
      // Even though it doesn't work, it shouldn't throw
      expect(() => provider.setToken("test-token")).not.toThrow();
    });

    it("should report authenticated after token is set", () => {
      provider.setToken("test-token");
      expect(provider.isAuthenticated()).toBe(true);
    });

    it("should clear authentication state", () => {
      provider.setToken("test-token");
      expect(provider.isAuthenticated()).toBe(true);

      provider.clearToken();
      expect(provider.isAuthenticated()).toBe(false);
    });
  });
});
