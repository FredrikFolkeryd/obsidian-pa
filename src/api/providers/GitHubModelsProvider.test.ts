/**
 * Tests for GitHubModelsProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubModelsProvider } from "./GitHubModelsProvider";

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  model: string;
}

describe("GitHubModelsProvider", () => {
  let provider: GitHubModelsProvider;

  beforeEach(() => {
    provider = new GitHubModelsProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct type", () => {
      expect(provider.type).toBe("github-models");
    });

    it("should have correct name", () => {
      expect(provider.name).toBe("GitHub Models");
    });

    it("should be enabled", () => {
      expect(provider.enabled).toBe(true);
    });
  });

  describe("getCapabilities", () => {
    it("should return correct capabilities", () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.supportsStreaming).toBe(false);
      expect(capabilities.supportsSystemPrompt).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(false);
      expect(capabilities.supportsVision).toBe(false);
    });
  });

  describe("isAuthenticated", () => {
    it("should return false when no token set", () => {
      expect(provider.isAuthenticated()).toBe(false);
    });

    it("should return true when token is set", () => {
      provider.setToken("test-token");
      expect(provider.isAuthenticated()).toBe(true);
    });

    it("should return false after token is cleared", () => {
      provider.setToken("test-token");
      provider.clearToken();
      expect(provider.isAuthenticated()).toBe(false);
    });
  });

  describe("getDefaultModel", () => {
    it("should return gpt-4o as default", () => {
      expect(provider.getDefaultModel()).toBe("gpt-4o");
    });
  });

  describe("validateToken", () => {
    it("should fail if no token is set", async () => {
      const result = await provider.validateToken();
      expect(result.success).toBe(false);
      expect(result.error).toBe("No token provided");
    });

    it("should validate with API call when token is set", async () => {
      // Mock fetch for the models endpoint
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ name: "gpt-4o", friendly_name: "GPT-4o" }]),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      provider.setToken("valid-token");
      const result = await provider.validateToken();

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://models.inference.ai.azure.com/models",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: "Bearer valid-token" },
        })
      );
    });

    it("should return error for invalid token", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ error: { message: "Invalid token" } }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      provider.setToken("invalid-token");
      const result = await provider.validateToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain("token");
    });
  });

  describe("getModels", () => {
    it("should fetch and return models", async () => {
      const mockModels = [
        { name: "gpt-4o", friendly_name: "GPT-4o" },
        { name: "gpt-4o-mini", friendly_name: "GPT-4o Mini" },
        { name: "text-embedding-ada-002" }, // Should be filtered out
      ];
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockModels),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      provider.setToken("test-token");
      const models = await provider.getModels();

      // Should filter out embedding models
      expect(models.length).toBe(2);
      expect(models.some((m) => m.id.includes("embedding"))).toBe(false);
    });

    it("should cache models", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ name: "gpt-4o" }]),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      provider.setToken("test-token");
      await provider.getModels();
      await provider.getModels();

      // Should only fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should return default models on API error", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      provider.setToken("test-token");
      const models = await provider.getModels();

      // Should return defaults
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBe("gpt-4o");
    });
  });

  describe("chat", () => {
    it("should throw if not authenticated", async () => {
      await expect(
        provider.chat([{ role: "user", content: "Hello" }], { model: "gpt-4o" })
      ).rejects.toThrow("Not authenticated");
    });

    it("should send chat request and return response", async () => {
      const mockChatResponse = {
        ok: true,
        json: () => Promise.resolve({
          id: "chat-123",
          model: "gpt-4o",
          choices: [{ message: { role: "assistant", content: "Hello there!" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockChatResponse);

      provider.setToken("test-token");
      const response = await provider.chat(
        [{ role: "user", content: "Hello" }],
        { model: "gpt-4o" }
      );

      expect(response.content).toBe("Hello there!");
      expect(response.model).toBe("gpt-4o");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://models.inference.ai.azure.com/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should include system prompt in messages", async () => {
      const mockChatResponse = {
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: "Response" } }],
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockChatResponse);

      provider.setToken("test-token");
      await provider.chat([{ role: "user", content: "Hello" }], {
        model: "gpt-4o",
        systemPrompt: "You are a helpful assistant",
      });

      const fetchMock = vi.mocked(global.fetch);
      const callArgs = fetchMock.mock.calls[0];
      const callBody = JSON.parse(callArgs[1]?.body as string) as ChatRequestBody;
      expect(callBody.messages[0].role).toBe("system");
      expect(callBody.messages[0].content).toBe("You are a helpful assistant");
    });

    it("should handle API errors gracefully", async () => {
      const mockErrorResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: () => Promise.resolve({ error: { message: "Rate limit exceeded" } }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockErrorResponse);

      provider.setToken("test-token");
      await expect(
        provider.chat([{ role: "user", content: "Hello" }], { model: "gpt-4o" })
      ).rejects.toThrow("Rate limit");
    });
  });
});
